import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'

const app=readFileSync(new URL('../src/App.vue',import.meta.url),'utf8').replace(/\r\n/g,'\n')
function declaration(name){
 const start=app.indexOf('function '+name+'(')
 assert.ok(start>=0,'Actual App function exists: '+name)
 const end=app.indexOf('\n}',start)
 assert.ok(end>start)
 return app.slice(start,end+2)
}
function screen({pathname='/',hash='',search='',saved=null,user=null}={}){
 const refs={view:{value:'studio'},catalogSource:{value:'all'},activeCategory:{value:'fashion'},searchQuery:{value:'stale search'},notFoundPath:{value:'old'},currentUser:{value:user}}
 const redirects=[]
 const window={location:{pathname,hash,search},history:{state:{existing:true},replaceState(state,title,url){redirects.push(url)}}}
 const code=['redirectMarketplace','getInitialView','resolveCurrentRoute','clearFilters'].map(declaration).join('\n')+'\nreturn {getInitialView,resolveCurrentRoute,clearFilters}'
 const functions=new Function(...Object.keys(refs),'window','localStorage',code)(...Object.values(refs),window,{getItem:()=>saved})
 return {...refs,...functions,redirects}
}

test('legacy marketplace hash and path links open seller designs in canonical Shop',()=>{
 for(const [pathname,hash,expected] of [
  ['/','#marketplace','/#shop'],
  ['/index.html','#marketplace','/index.html#shop'],
  ['/marketplace','','/#shop'],
  ['/kickcraft/marketplace/','','/kickcraft/#shop'],
 ]){
  const initial=screen({pathname,hash})
  assert.equal(initial.getInitialView(),'shop')
  assert.equal(initial.catalogSource.value,'seller')
  assert.equal(initial.activeCategory.value,'all')
  assert.equal(initial.searchQuery.value,'')
  assert.deepEqual(initial.redirects,[expected])
  const navigation=screen({pathname,hash})
  navigation.resolveCurrentRoute()
  assert.equal(navigation.view.value,'shop')
  assert.equal(navigation.catalogSource.value,'seller')
  assert.equal(navigation.notFoundPath.value,'')
  assert.deepEqual(navigation.redirects,[expected])
 }
})

test('legacy saved view migrates and legacy links retain their query string',()=>{
 const saved=screen({saved:'marketplace'})
 assert.equal(saved.getInitialView(),'shop')
 assert.equal(saved.catalogSource.value,'seller')
 const query=screen({hash:'#marketplace',search:'?campaign=test'})
 assert.equal(query.getInitialView(),'shop')
 assert.deepEqual(query.redirects,['/?campaign=test#shop'])
})

test('clearing filters restores all sources and route authorization remains intact',()=>{
 const state=screen({hash:'#marketplace'})
 state.resolveCurrentRoute()
 state.clearFilters()
 assert.equal(state.catalogSource.value,'all')
 assert.equal(state.activeCategory.value,'all')
 assert.equal(state.searchQuery.value,'')
 for(const [user,expected]of [[null,'login'],[{role:'seller'},'not-found'],[{role:'owner'},'admin']]){
  const admin=screen({hash:'#admin',user})
  admin.resolveCurrentRoute()
  assert.equal(admin.view.value,expected)
 }
 const unknown=screen({pathname:'/unknown'})
 unknown.resolveCurrentRoute()
 assert.equal(unknown.view.value,'not-found')
})
