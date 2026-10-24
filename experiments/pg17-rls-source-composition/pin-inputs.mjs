import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { root } from '../pg17-routines/runtime.mjs'
import { inventory,own } from './inputs.mjs'
const data=await inventory()
await writeFile(join(root,own,'input-pins.json'),JSON.stringify(data,null,2)+'\n')
console.log(JSON.stringify({sources:Object.keys(data.sources).length,dependencies:Object.keys(data.commonJS).length,runtimeFiles:Object.keys(data.runtimeFiles).length}))
