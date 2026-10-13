import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const app=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8')
function customerFunction(name,bindings){
 const start=app.indexOf('function '+name+'('),end=app.indexOf('\n}',start)
 assert.ok(start>=0&&end>start,'Customer function exists: '+name)
 return new Function(...Object.keys(bindings),app.slice(start,end+2)+';return '+name)(...Object.values(bindings))
}
test('customer picker accepts arbitrary RGB hex and keeps seller palette unchanged',()=>{
 const palette=[{name:'Rust',value:'#b94d27'}],chosen=[]
 const pick=customerFunction('chooseCustomColor',{shoeColors:{value:palette},chooseColor:color=>chosen.push(color)})
 pick('#13ABCD');pick('#B94D27')
 for(const value of ['#fff','#12345678','red','<script>',null])pick(value)
 assert.deepEqual(chosen,[{name:'Custom #13ABCD',value:'#13abcd'},palette[0]])
 assert.deepEqual(palette,[{name:'Rust',value:'#b94d27'}])
})
test('custom color changes selected part only and waits for model readiness',()=>{
 const partColors={value:{upper:{name:'White',value:'#ffffff'}}},modelReady={value:true},selectedPartId={value:'laces'}
 const writes=[],color={name:'Custom #13ABCD',value:'#13abcd'}
 const choose=customerFunction('chooseColor',{partColors,modelReady,selectedPartId,selectedPart:{value:{material:'LacesMaterial'}},modelViewer:{value:{model:{}}},setMaterialColor:(model,material,value)=>{writes.push([material,value]);return true}})
 choose(color)
 assert.deepEqual(writes,[['LacesMaterial','#13abcd']]);assert.deepEqual(partColors.value.laces,color)
 assert.equal(partColors.value.upper.value,'#ffffff')
 modelReady.value=false;choose({name:'Other',value:'#aabbcc'});assert.equal(writes.length,1)
})
