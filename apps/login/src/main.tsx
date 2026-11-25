import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { createLoginQueryClient, createLoginRouter, LoginApp } from './App'

const queryClient = createLoginQueryClient()
const router = createLoginRouter()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LoginApp queryClient={queryClient} router={router} />
  </StrictMode>,
)
