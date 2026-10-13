import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
const editor=readFileSync(new URL('../src/components/SellerProductEditor.vue',import.meta.url),'utf8')
function statusWatcher(form,message){
 let callback
 const start=editor.indexOf('watch(()=>[props.shoe.publicationState'),end=editor.indexOf('async function loaded()',start)
 assert.ok(start>=0&&end>start)
 new Function('watch','props','form','message',editor.slice(start,end))((_,fn)=>{callback=fn},{shoe:{}},form,message)
 return callback
}

test('approval and rejection clear old submission messages without replacing unsaved product fields',()=>{
 for(const state of ['approved','rejected','draft']){
  const form={publicationState:'pending',reviewNote:'',name:'Unsaved name',price:6000},message={value:'Submitted. Admin must approve before this appears in Shop.'}
  statusWatcher(form,message)([state,'Admin review'])
  assert.equal(message.value,'');assert.equal(form.publicationState,state);assert.equal(form.reviewNote,'Admin review')
  assert.equal(form.name,'Unsaved name');assert.equal(form.price,6000)
 }
})

test('a review-note refresh with the same status preserves the current success message',()=>{
 const form={publicationState:'draft'},message={value:'Draft saved.'}
 statusWatcher(form,message)(['draft','Updated note'])
 assert.equal(message.value,'Draft saved.');assert.equal(form.reviewNote,'Updated note')
})

test('admin can reject a draft while approval still requires submission',()=>{
 const source=readFileSync(new URL('../api/products/review.php',import.meta.url),'utf8')
 const rule=source.split(/\r?\n/).find(line=>line.trimStart().startsWith("if($row['publication_state']"))
 assert.ok(rule)
 const encoded=Buffer.from(rule).toString('base64')
 const code=`function scanFail($message,$status=400){throw new RuntimeException($message,$status);}$out=[];foreach(['draft','pending','approved','rejected'] as $state)foreach(['approved','rejected'] as $status){$row=['publication_state'=>$state];try{eval(base64_decode('${encoded}'));$out[]=true;}catch(Throwable $e){$out[]=false;}}echo json_encode($out);`
 const result=JSON.parse(execFileSync('C:/xampp/php/php.exe',['-r',code],{encoding:'utf8'}))
 assert.deepEqual(result,[false,true,true,true,false,true,false,false])
})
