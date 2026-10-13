import test, {after} from 'node:test'
import assert from 'node:assert/strict'
import {createServer} from 'vite'
import vue from '@vitejs/plugin-vue'
import {createSSRApp, h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import path from 'node:path'

const server = await createServer({configFile:false,cacheDir:'node_modules/.vite-ui-tests',plugins:[vue()],resolve:{alias:{'@':path.resolve('src')}},server:{middlewareMode:true,hmr:false},appType:'custom'})
after(()=>server.close())
const component = async file => (await server.ssrLoadModule('/src/components/ui/'+file)).default

test('shared button keeps form type, disabled and accessible selected state',async()=>{
 const Button = await component('button/Button.vue')
 const html = await renderToString(createSSRApp({render:()=>h(Button,{type:'button',disabled:true,'aria-pressed':true,variant:'outline'},()=> 'Upper')}))
 assert.match(html,/type="button"/)
 assert.match(html,/disabled/)
 assert.match(html,/aria-pressed="true"/)
 assert.match(html.replace(/<!--.*?-->/g,''),/>Upper<\/button>/)
 const submit = await renderToString(createSSRApp({render:()=>h(Button,{type:'submit'},()=> 'Save draft')}))
 assert.match(submit,/type="submit"/)
})

test('shared fields keep entered values, input validation and visible user text',async()=>{
 const Input = await component('input/Input.vue'), Textarea = await component('textarea/Textarea.vue')
 const input = await renderToString(createSSRApp({render:()=>h(Input,{modelValue:'maria@example.com',type:'email',required:true,autocomplete:'email','aria-label':'Email address'})}))
 assert.match(input,/value="maria@example.com"/)
 assert.match(input,/type="email"/)
 assert.match(input,/required/)
 assert.match(input,/autocomplete="email"/)
 const area = await renderToString(createSSRApp({render:()=>h(Textarea,{modelValue:'Keep <this> design',maxlength:3000})}))
 assert.match(area,/Keep &lt;this&gt; design/)
 assert.match(area,/maxlength="3000"/)
})


test('studio section choices expose the selected section without changing design values',async()=>{
 const Sections=(await server.ssrLoadModule('/src/components/StudioSections.vue')).default
 for (const selected of ['parts','charms','size']) {
  const html=await renderToString(createSSRApp({render:()=>h(Sections,{modelValue:selected})}))
  const buttons=[...html.replace(/<!--.*?-->/g,'').matchAll(/<button\b([^>]*)>(.*?)<\/button>/g)]
  assert.equal(buttons.length,3)
  assert.equal(buttons.filter(([,attrs])=>attrs.includes('aria-pressed="true"')).length,1)
  assert.match(buttons.find(([,attrs])=>attrs.includes('aria-pressed="true"'))[2],new RegExp(selected==='parts'?'Parts &amp; colors':selected==='charms'?'Charms':'Size'))
 }
})
