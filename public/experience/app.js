(()=>{
  'use strict';
  const byId=id=>document.getElementById(id),form=byId('feedback-form'),supplement=byId('supplement-form');
  if(!form||!supplement)return;
  const email=byId('report-email'),dateInput=byId('report-date'),comment=byId('report-comment'),recordLink=byId('record-link');
  const status=byId('form-status'),submit=byId('preview-submit'),receipt=byId('receipt-panel'),suppStatus=byId('supplement-status');
  const draftKey='uyi-experience-draft-v1';
  const activityLabels={ai_space:'AI空間を試した',studio:'UYI Studioを試した',setup:'インストール・ログインで止まった',other:'その他'};
  const completionLabels={yes:'できた',partly:'一部できた',no:'できなかった',blocked:'試す前に止まった'};
  const reuseLabels={yes:'使いたい',conditional:'条件次第で使いたい',unsure:'まだわからない',no:'今は使わない'};
  let resolvedDate='',reportAttempt=null,supplementAttempt=null,currentReport=null,busy=false,reportCompleted=false,storageAvailable=true;
  function dayInJapan(offset=0){
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    return new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)+offset)).toISOString().slice(0,10);
  }
  function validDay(value){
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
    const [y,m,d]=value.split('-').map(Number),day=new Date(Date.UTC(y,m-1,d));
    return y>=1000&&day.getUTCFullYear()===y&&day.getUTCMonth()===m-1&&day.getUTCDate()===d&&value<=dayInJapan();
  }
  const displayDay=value=>value.replace(/^(\d{4})-(\d{2})-(\d{2})$/,'$1年$2月$3日');
  const selected=name=>form.querySelector(`input[name="${name}"]:checked`)?.value||'';
  const activities=()=>[...form.querySelectorAll('input[name="activities"]:checked')].map(x=>x.value);
  const selectedDay=()=>selected('dateChoice')==='custom'?dateInput.value:selected('dateChoice')?resolvedDate:'';
  function updateDate(){byId('custom-date-row').hidden=selected('dateChoice')!=='custom';dateInput.max=dayInJapan();byId('chosen-date').textContent=validDay(selectedDay())?`利用日：${displayDay(selectedDay())}`:'日付を選んでください。';}
  function updateStudio(){
    const studio=activities().includes('studio');byId('studio-note').hidden=!studio;
    byId('comment-help').textContent=studio?'1〜2文で構いません。Studioの操作に基づく具体的な改善案を、1つ以上含めてください。':'1〜2文で構いません。何を試し、どうなったか、気になった点を教えてください。';
    comment.placeholder=studio?'例：小物の3D生成を試しました。生成中に待ち時間が分からなかったので、進み具合や中止ボタンがあると助かります。':'例：小物をAI空間に置いてみました。置く位置の調整が難しかったので、位置を元に戻す操作があると使いやすいです。';
  }
  function validLink(value){if(!value)return true;try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&Boolean(u.hostname)&&!u.username&&!u.password;}catch{return false;}}
  const normalizeEmail=value=>value.trim().toLowerCase();
  const validEmail=value=>value.length<=254&&value.split('@')[0].length<=64&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  function reportDraft(){return {email:email.value,dateChoice:selected('dateChoice'),resolvedDate:selectedDay(),experienceDate:dateInput.value,activities:activities(),completion:selected('completion'),reuse:selected('reuse'),comment:comment.value,recordLink:recordLink.value};}
  function supplementDraft(){return {email:byId('supplement-email').value,originalReportId:byId('original-report-id').value,recordLink:byId('supplement-record-link').value,note:byId('supplement-note').value};}
  function saveDraft(){
    if(!storageAvailable)return;
    try{sessionStorage.setItem(draftKey,JSON.stringify({email:email.value,report:reportCompleted?null:reportDraft(),supplement:supplementDraft(),reportAttempt:reportCompleted?null:reportAttempt,supplementAttempt}));}
    catch{storageAvailable=false;byId('draft-state').textContent='この環境では一時下書きを保存できません。入力内容はページを開いている間、そのまま残っています。';}
  }
  function readAttempt(value){return value&&typeof value.signature==='string'&&typeof value.requestId==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId)?{signature:value.signature,requestId:value.requestId}:null;}
  function restoreDraft(){
    try{
      const raw=sessionStorage.getItem(draftKey);if(!raw)return;const saved=JSON.parse(raw);if(!saved||typeof saved!=='object'||Array.isArray(saved))return;
      if(typeof saved.email==='string')email.value=saved.email.slice(0,254);
      const data=saved.report;
      if(data&&typeof data==='object'&&!Array.isArray(data)){
        for(const [key,node,max] of [['email',email,254],['comment',comment,1500],['recordLink',recordLink,2000],['experienceDate',dateInput,10]])if(typeof data[key]==='string')node.value=data[key].slice(0,max);
        for(const name of ['dateChoice','completion','reuse'])for(const input of form.querySelectorAll(`input[name="${name}"]`))input.checked=input.value===data[name];
        for(const input of form.querySelectorAll('input[name="activities"]'))input.checked=Array.isArray(data.activities)&&data.activities.includes(input.value);
        if(validDay(data.resolvedDate)){resolvedDate=data.resolvedDate;const choice=selected('dateChoice');if((choice==='today'&&resolvedDate!==dayInJapan())||(choice==='yesterday'&&resolvedDate!==dayInJapan(-1))){form.querySelector('input[name="dateChoice"][value="custom"]').checked=true;dateInput.value=resolvedDate;}}
        else for(const input of form.querySelectorAll('input[name="dateChoice"]'))input.checked=false;
        reportAttempt=readAttempt(saved.reportAttempt);byId('draft-restored').hidden=false;
      }
      if(saved.supplement&&typeof saved.supplement==='object')for(const [key,id,max] of [['email','supplement-email',254],['originalReportId','original-report-id',100],['recordLink','supplement-record-link',2000],['note','supplement-note',1500]])if(typeof saved.supplement[key]==='string')byId(id).value=saved.supplement[key].slice(0,max);
      supplementAttempt=readAttempt(saved.supplementAttempt);
    }catch{storageAvailable=false;byId('draft-state').textContent='一時下書きを利用できません。このページを開いたままご記入ください。';}
  }
  function showStatus(target,message,state='error'){target.textContent=message;target.dataset.state=state;target.hidden=false;target.focus();}
  function clearErrors(){status.hidden=true;status.textContent='';for(const input of form.querySelectorAll('[aria-invalid]'))input.removeAttribute('aria-invalid');}
  function showError(message,target){showStatus(status,message);if(target)target.setAttribute('aria-invalid','true');}
  function setBusy(value,mode){
    busy=value;for(const input of document.querySelectorAll('#feedback-form input,#feedback-form textarea,#feedback-form button,#supplement-form input,#supplement-form textarea,#supplement-form button'))input.disabled=value;
    submit.textContent=value&&mode==='report'?'送信しています…':'レポートを送信する';byId('send-supplement').textContent=value&&mode==='supplement'?'送信しています…':'補足を送信する';form.setAttribute('aria-busy',String(value));supplement.setAttribute('aria-busy',String(value));
  }
  function attemptFor(mode,payload){const signature=JSON.stringify(payload),old=mode==='report'?reportAttempt:supplementAttempt;if(old?.signature===signature)return old;const attempt={signature,requestId:crypto.randomUUID()};if(mode==='report')reportAttempt=attempt;else supplementAttempt=attempt;return attempt;}
  async function send(payload){
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/experience',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload),signal:controller.signal});
      let data;try{data=await response.json();}catch{data=null;}
      if(!response.ok||data?.success!==true||typeof data.reportId!=='string'||!/^([0-9a-f]{8})-([0-9a-f]{4})-4([0-9a-f]{3})-[89ab]([0-9a-f]{3})-([0-9a-f]{12})$/i.test(data.reportId)||data.status!=='received'||data.kind!==payload.kind||!['present','missing'].includes(data.evidenceStatus)){const error=new Error('save_unconfirmed');error.status=response.status;error.code=data?.error;throw error;}
      return data;
    }finally{clearTimeout(timer);}
  }
  function errorCopy(error){
    if(error.status===429||error.code==='rate_limited')return '送信が続いています。少し時間をおいて、もう一度お試しください。入力内容は残っています。';
    if(error.status===400||error.status===413)return 'メールアドレス・利用日・入力内容をご確認ください。長すぎる項目や空欄がないか確認し、もう一度お試しください。入力内容は残っています。';
    if(error.status===403)return '送信を確認できませんでした。このページを開き直してから、もう一度お試しください。入力内容は現在のページに残っています。';
    if(error.status===409)return '送信内容を確認できませんでした。入力内容は残っています。内容を確認し、解決しない場合は運営へご連絡ください。';
    return '保存結果を確認できませんでした。入力内容は残っています。接続を確認し、少し時間をおいて再度お試しください。';
  }
  function updateReceipt(){
    byId('receipt-id').textContent=currentReport.reportId;byId('receipt-id-copy').value=currentReport.reportId;byId('receipt-date').textContent=displayDay(currentReport.experienceDate);byId('receipt-email').textContent=currentReport.email;
    byId('record-followup-title').textContent=currentReport.evidenceStatus==='present'?'操作記録のリンクを受け付けました':'操作記録はあとから補足できます';
    byId('record-followup-copy').textContent=currentReport.evidenceStatus==='present'?'運営が閲覧できるか、利用日や操作内容が分かるかを確認します。リンクの提出だけで謝礼が確定するものではありません。':'本文は受け付けました。参加特典の確認には、利用日や操作内容が分かる記録などの参加条件を満たす必要があります。';
    const summary=byId('submitted-summary');summary.replaceChildren();
    for(const [title,value] of [['今回行ったこと',currentReport.activities.map(value=>activityLabels[value]).join('、')],['やりたかったことはできましたか？',completionLabels[currentReport.completion]],['今後もUYIを使いたいですか？',reuseLabels[currentReport.reuse]],['理由と具体的な体験',currentReport.comment],['操作記録のリンク',currentReport.recordLink||'未記入']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=title;dd.textContent=value;summary.append(dt,dd);}
  }
  function resetMain(keepEmail){
    const previous=keepEmail?email.value:'';form.reset();email.value=previous;dateInput.value='';resolvedDate='';reportAttempt=null;reportCompleted=false;currentReport=null;receipt.hidden=true;form.hidden=false;byId('draft-restored').hidden=true;clearErrors();updateDate();updateStudio();saveDraft();
  }
  function openSupplement(prefill){
    byId('supplement-details').open=true;
    if(prefill&&currentReport){byId('supplement-email').value=currentReport.email;byId('original-report-id').value=currentReport.reportId;}
    else if(!byId('supplement-email').value)byId('supplement-email').value=email.value;
    saveDraft();const target=!byId('supplement-email').value?byId('supplement-email'):!byId('original-report-id').value?byId('original-report-id'):byId('supplement-record-link');target.focus();
  }
  restoreDraft();updateDate();updateStudio();
  form.addEventListener('input',()=>{if(!busy){clearErrors();saveDraft();}});
  form.addEventListener('change',event=>{if(busy)return;if(event.target.name==='dateChoice'){resolvedDate=event.target.value==='today'?dayInJapan():event.target.value==='yesterday'?dayInJapan(-1):dateInput.value;updateDate();}if(event.target===dateInput)updateDate();if(event.target.name==='activities')updateStudio();clearErrors();saveDraft();});
  supplement.addEventListener('input',()=>{if(!busy){suppStatus.hidden=true;saveDraft();}});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;clearErrors();email.value=normalizeEmail(email.value);comment.value=comment.value.trim();recordLink.value=recordLink.value.trim();
    if(!validEmail(email.value)||!email.validity.valid)return showError('初回のお申込みと同じメールアドレスをご確認ください。',email);
    if(!validDay(selectedDay()))return showError('実際に使った日を選んでください。未来の日付や存在しない日付は指定できません。',dateInput);
    if(!activities().length)return showError('今回行ったことを1つ以上選んでください。',byId('question-activities'));
    if(!selected('completion'))return showError('やりたかったことができたか、選んでください。');
    if(!selected('reuse'))return showError('今後も使いたいか、今の気持ちを選んでください。');
    if(!comment.value)return showError(activities().includes('studio')?'Studioで試した操作と具体的な改善案を1つ以上お書きください。':'理由と具体的な体験を、1〜2文で教えてください。',comment);
    if(!validLink(recordLink.value))return showError('共有リンクをご確認ください。https://またはhttp://から始まる、パスワードを含まないURLをご記入ください。',recordLink);
    const payload={kind:'experience_report',email:email.value,experienceDate:selectedDay(),activities:activities(),completion:selected('completion'),reuse:selected('reuse'),comment:comment.value,recordLink:recordLink.value,website:byId('report-website').value,language:'ja',source:'experience'};
    const attempt=attemptFor('report',payload);saveDraft();setBusy(true,'report');showStatus(status,'レポートを送信しています。このままお待ちください。','sending');
    try{const result=await send({...payload,requestId:attempt.requestId});currentReport={...payload,reportId:result.reportId,evidenceStatus:result.evidenceStatus};reportCompleted=true;updateReceipt();form.hidden=true;receipt.hidden=false;byId('receipt-title').focus();saveDraft();}
    catch(error){saveDraft();showStatus(status,errorCopy(error));}
    finally{setBusy(false);}
  });
  supplement.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const suppEmail=byId('supplement-email'),id=byId('original-report-id'),link=byId('supplement-record-link'),note=byId('supplement-note');
    suppEmail.value=normalizeEmail(suppEmail.value);id.value=id.value.trim();link.value=link.value.trim();note.value=note.value.trim();
    if(!validEmail(suppEmail.value)||!suppEmail.validity.valid)return showStatus(suppStatus,'初回のお申込みと同じメールアドレスをご確認ください。');
    if(!id.value||id.value.length>100)return showStatus(suppStatus,'送信後に表示された報告番号をご記入ください。');
    if(!validLink(link.value))return showStatus(suppStatus,'共有リンクをhttps://またはhttp://から始まる、パスワードを含まないURLでご記入ください。');
    if(!link.value&&!note.value)return showStatus(suppStatus,'操作記録のリンクか補足のどちらかを、1つ以上ご記入ください。');
    const payload={kind:'experience_supplement',email:suppEmail.value,originalReportId:id.value,recordLink:link.value,note:note.value,website:byId('supplement-website').value,language:'ja',source:'experience'};
    const attempt=attemptFor('supplement',payload);saveDraft();setBusy(true,'supplement');showStatus(suppStatus,'補足を送信しています。このままお待ちください。','sending');
    try{const result=await send({...payload,requestId:attempt.requestId});showStatus(suppStatus,'補足を受け付けました。追加情報と元の報告番号を運営が確認します。謝礼はまだ確定していません。','success');link.value='';note.value='';supplementAttempt=null;saveDraft();}
    catch(error){saveDraft();showStatus(suppStatus,errorCopy(error));}
    finally{setBusy(false);}
  });
  byId('clear-draft').addEventListener('click',()=>{if(busy)return;resetMain(false);supplement.reset();supplementAttempt=null;suppStatus.hidden=true;try{sessionStorage.removeItem(draftKey);}catch{}byId('draft-state').textContent='下書きを消しました。次の入力から、このタブに一時保存します。';email.focus();});
  byId('next-report').addEventListener('click',()=>{if(!busy){resetMain(true);form.querySelector('input[name="dateChoice"]').focus();}});
  byId('jump-supplement').addEventListener('click',event=>{event.preventDefault();if(!busy)openSupplement(false);});
  byId('open-supplement').addEventListener('click',()=>{if(!busy)openSupplement(true);});
  byId('supplement-details').addEventListener('toggle',()=>{if(byId('supplement-details').open&&!busy&&!byId('supplement-email').value){byId('supplement-email').value=email.value;saveDraft();}});
  byId('copy-report-id').addEventListener('click',async()=>{const field=byId('receipt-id-copy');try{await navigator.clipboard.writeText(field.value);byId('copy-status').textContent='報告番号をコピーしました。';}catch{field.focus();field.select();byId('copy-status').textContent='報告番号を選択しました。コピーして保存してください。';}});
  submit.disabled=false;byId('send-supplement').disabled=false;
})();
