import React from 'react'
import { createRoot } from 'react-dom/client'
import { PurchasePanel } from '../../packages/web/src/components/purchase/purchase-panel'
createRoot(document.getElementById('root')!).render(<PurchasePanel enabled />)
