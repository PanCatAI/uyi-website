(()=>{
  'use strict';
  const form=document.getElementById('mac-application-form');
  if(!form)return;
  const submit=document.getElementById('application-submit');
  const status=document.getElementById('application-status');
  const success=document.getElementById('application-success');
  const successTitle=document.getElementById('success-title');
  const successEmail=document.getElementById('success-email');
  const sources=new Set(['homepage','event','creator','outreach','referral','other']);
  const sourceField=form.elements.namedItem('source');
  const initialSource=new URLSearchParams(location.search).get('source');
  if(sources.has(initialSource))sourceField.value=initialSource;

  let pending=false;
  let lastAttempt=null;
  const defaultButton=submit.textContent;
  submit.disabled=false;

  function requestId(){
    if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
    const bytes=crypto.getRandomValues(new Uint8Array(16));
    bytes[6]=(bytes[6]&15)|64;
    bytes[8]=(bytes[8]&63)|128;
    const hex=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
  }

  function showStatus(message,state){
    status.textContent=message;
    status.dataset.state=state;
    status.hidden=false;
  }

  function fieldValue(name){return form.elements.namedItem(name).value.trim();}

  for(const control of form.querySelectorAll('input,textarea,select')){
    control.addEventListener('invalid',()=>{
      control.setCustomValidity('');
      if(control.validity.valueMissing){
        const messages={
          email:'メールアドレスをご記入ください。',
          macEnvironment:'Macの機種・チップ・macOSをご記入ください。',
          macConfirmed:'Macを利用できる方が対象です。チェックして確認してください。',
          creativeExperience:'これまでの創作経験を選択してください。',
          experienceDirection:'体験してみたい内容を選択してください。',
          intent:'UYIで試してみたいことをご記入ください。',
          source:'この案内を知ったきっかけを選択してください。'
        };
        control.setCustomValidity(messages[control.name]||'この項目をご記入ください。');
      }else if(control.type==='email'&&control.validity.typeMismatch){
        control.setCustomValidity('有効なメールアドレスをご記入ください。');
      }else if(control.validity.tooLong){
        control.setCustomValidity('入力が長すぎます。文字数を減らしてください。');
      }
    });
    for(const event of ['input','change'])control.addEventListener(event,()=>control.setCustomValidity(''));
  }

  function errorMessage(response,data){
    if(response.status===429||data?.error==='rate_limited')return '短い間に送信が続いています。少し時間をおいてから、もう一度お試しください。入力内容はそのまま残っています。';
    if(data?.error==='invalid_email')return 'メールアドレスをご確認ください。入力内容はそのまま残っています。';
    if(response.status===400||response.status===413||data?.error==='invalid_application')return '入力内容をご確認ください。長すぎる項目や未入力の項目がないか確認し、もう一度お試しください。';
    return '送信を確認できませんでした。接続を確認し、もう一度お試しください。入力内容はそのまま残っています。お困りの場合は partnerships@uyi.live へご連絡ください。';
  }

  form.addEventListener('input',()=>{
    if(!pending){status.hidden=true;status.textContent='';}
  });
  form.addEventListener('change',()=>{
    if(!pending){status.hidden=true;status.textContent='';}
  });

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(pending)return;
    const email=form.elements.namedItem('email');
    email.value=email.value.trim();
    if(!form.reportValidity())return;

    const fields={
      kind:'mac_application',
      email:fieldValue('email'),
      macEnvironment:fieldValue('macEnvironment'),
      macConfirmed:form.elements.namedItem('macConfirmed').checked,
      creativeExperience:fieldValue('creativeExperience'),
      experienceDirection:fieldValue('experienceDirection'),
      intent:fieldValue('intent'),
      xAccount:fieldValue('xAccount'),
      source:fieldValue('source'),
      language:'ja',
      website:fieldValue('website')
    };
    if(!fields.macEnvironment||!fields.intent){
      showStatus('お使いのMacと試してみたいことを、空白以外の文字でご記入ください。','error');
      status.focus();
      return;
    }
    const signature=JSON.stringify(fields);
    if(!lastAttempt||lastAttempt.signature!==signature){
      lastAttempt={signature,payload:{...fields,requestId:requestId()}};
    }
    const payload=lastAttempt.payload;
    pending=true;
    submit.disabled=true;
    submit.textContent='送信しています…';
    form.setAttribute('aria-busy','true');
    showStatus('お申込みを送信しています。このままお待ちください。','submitting');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/subscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        credentials:'same-origin',
        cache:'no-store',
        body:JSON.stringify(payload),
        signal:controller.signal
      });
      let data;
      try{data=await response.json();}catch{data=null;}
      if(response.ok&&data?.success===true){
        form.hidden=true;
        successEmail.textContent='ご連絡先：'+payload.email;
        success.hidden=false;
        successTitle.focus();
      }else{
        showStatus(errorMessage(response,data),'error');
        status.focus();
      }
    }catch{
      showStatus('送信を確認できませんでした。接続を確認し、もう一度お試しください。入力内容はそのまま残っています。','error');
      status.focus();
    }finally{
      clearTimeout(timeout);
      pending=false;
      submit.disabled=false;
      submit.textContent=defaultButton;
      form.setAttribute('aria-busy','false');
    }
  });
})();
