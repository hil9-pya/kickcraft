<script setup>
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {ref,reactive,computed,onMounted,onBeforeUnmount} from 'vue'
import {api} from '../api.js'
import {validateStore,pickupActions,pickupLabels} from '../seller.js'
import {forgetCompletedScan} from '../scan-capture.js'
import PhotoScanner from './PhotoScanner.vue'
import ConfirmModal from './ConfirmModal.vue'
import SharedTemplateLibrary from './SharedTemplateLibrary.vue'
import SellerProductEditor from './SellerProductEditor.vue'
import '../seller.css'
const props=defineProps({user:{type:Object,required:true}})
const emit=defineEmits(['changed','signedOut'])
const profile=ref(null),products=ref([]),orders=ref([]),tab=ref('products'),editing=ref(null),scanning=ref(false),uploading=ref(false),busy=ref(false),loading=ref(true),error=ref(''),message=ref('')
const store=reactive({storeName:'',description:'',pickupAddress:'',contact:''}),glb=ref(null),thumbnail=ref(null)
const completing=ref(null)
const orderFilter=ref('all'),orderNotes=reactive({})
const visibleOrders=computed(()=>orders.value.filter(o=>orderFilter.value==='all'||o.status===orderFilter.value))
const guideSteps=[{title:'Your store is approved',text:'Customers see your store name and pickup address. Check these under Store settings.',tab:'settings'},{title:'Create a shoe',text:'Use Scan from photos for your actual shoe. Choose overlapping photos or a video of three slow passes around the shoe, review background masks, and wait for reconstruction.',tab:'products'},{title:'Make parts customizable',text:'Compare the scan against the photographs. Paint at least two real shoe regions, name them, then test each color in Product details.',tab:'products'},{title:'Request listing review',text:'Set description, price, stock, sizes and palette. Submit for review. Only admin-approved listings appear publicly.',tab:'products'},{title:'Fulfill pickup orders',text:'Confirm each reservation, mark it ready, then complete it after collection and payment in your store. Cancellation restores one pair.',tab:'orders'}]
const guide=computed(()=>guideSteps[profile.value?.tutorialStep || 0])
let timer,closed=false
async function refresh(quiet=false) {
 if(closed)return
 if(!quiet)loading.value=true
 try {
  const result=await api('sellers/profile.php');const previous=profile.value?.status;profile.value=result.seller
  if(!quiet||previous!==profile.value.status)Object.assign(store,result.seller)
  if(profile.value.status==='approved') {
   if(!quiet||previous!==profile.value.status){const results=await Promise.all([api('products/list.php'),api('sellers/orders.php')]);products.value=results[0].shoes;orders.value=results[1].reservations}
  }else {products.value=[];orders.value=[];editing.value=null;scanning.value=false;uploading.value=false}
  if(!quiet)error.value=''
 }catch(cause){error.value=cause.message;if(cause.status===401)emit('signedOut')}
 finally{loading.value=false}
}
async function create(source) {
 busy.value=true;error.value=''
 try{const result=await api('products/create.php',{method:'POST',body:{source,template:'kickcraft-one'}});editing.value=result.shoe;await refresh()}catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function scanned(draft,scanId) {
 busy.value=true;error.value=''
 try{const result=await api('products/create.php',{method:'POST',body:{source:'scan',scanId}});editing.value=result.shoe;scanning.value=false;forgetCompletedScan(draft.glbPath,props.user.id);await refresh()}
 catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function upload() {
 if(!glb.value||!thumbnail.value){error.value='Choose a GLB and its PNG thumbnail.';return}
 if(glb.value.size>20*1024*1024||thumbnail.value.size>10*1024*1024){error.value='GLB limit: 20 MB. Thumbnail limit: 10 MB.';return}
 busy.value=true;error.value=''
 try{const body=new FormData();body.append('file',glb.value);body.append('thumbnail',thumbnail.value);const result=await api('products/upload.php',{method:'POST',body});editing.value=result.shoe;uploading.value=false;glb.value=null;thumbnail.value=null;await refresh()}
 catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function saveStore() {
 error.value=validateStore(store);message.value='';if(error.value)return
 busy.value=true
 try{const result=await api('sellers/update-profile.php',{method:'POST',body:store});profile.value=result.seller;Object.assign(store,result.seller);message.value=profile.value.status==='pending'?'Store changes saved. Admin review is required before selling.':'Store settings saved.';emit('changed');await refresh()}
 catch(cause){error.value=cause.message}finally{busy.value=false}
}
async function tutorial(step) {
 try{profile.value=(await api('sellers/update-profile.php',{method:'POST',body:{tutorialStep:step}})).seller;if(step<5)tab.value=guideSteps[step].tab}
 catch(cause){error.value=cause.message}
}
async function updateOrder(order,status) {
 const notes=(orderNotes[order.id]??order.notes??'').trim()
 if(status==='cancelled'&&!notes){error.value='Add a cancellation reason in order notes.';return}
 busy.value=true;error.value=''
 try{await api('reservations/update-status.php',{method:'POST',body:{id:order.id,status,notes}});await refresh();message.value='Pickup order updated.';emit('changed')}
 catch(cause){error.value=cause.message}finally{busy.value=false}
}
function saved(shoe){editing.value=shoe;refresh();emit('changed')}
onMounted(async()=>{await refresh();timer=setInterval(()=>refresh(true),30000)})
onBeforeUnmount(()=>{closed=true;clearInterval(timer)})
</script>
<template>
 <main class="seller">
  <header><div><p class="tag">Seller Studio</p><h1>{{profile?.storeName || 'Your store'}}</h1></div><div class="actions"><a href="#marketplace">Marketplace</a><Button variant="outline" :disabled="loading||busy" @click="refresh()">Refresh</Button></div></header>
  <p v-if="loading" role="status">Loading Seller Studio…</p><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="message" class="success" role="status">{{message}}</p>
  <template v-if="profile">
   <template v-if="profile.status!=='approved'">
    <section class="notice stack"><h2>{{profile.status==='pending'?'Application awaiting admin review':profile.status==='rejected'?'Application needs changes':'Store suspended'}}</h2><p>{{profile.status==='pending'?'You can sign in and update your store. Product creation and order management unlock after approval.':profile.status==='rejected'?'Correct the store details below, then resubmit your application.':'Contact the owner about the review note. Listings are hidden while your store is suspended.'}}</p><p v-if="profile.reviewNote"><strong>Admin note:</strong> {{profile.reviewNote}}</p></section>
   </template>
   <template v-else>
    <section v-if="guide&&!editing&&!scanning" class="tutorial stack" aria-label="Seller walkthrough"><div class="actions"><h2>Getting started · {{profile.tutorialStep+1}} / 5</h2><Button variant="outline" @click="tutorial(5)">Dismiss walkthrough</Button></div><h3>{{guide.title}}</h3><p>{{guide.text}}</p><div class="actions"><Button variant="outline" @click="tab=guide.tab">Show {{guide.tab==='orders'?'pickup orders':guide.tab==='settings'?'store settings':'products'}}</Button><Button variant="default" class="primary" @click="tutorial(profile.tutorialStep+1)">{{profile.tutorialStep===4?'Finish walkthrough':'Next step'}}</Button></div></section>
    <nav aria-label="Seller sections"><Button variant="outline" v-for="item in ['products','templates','orders','settings']" :key="item" :aria-current="tab===item" @click="tab=item;editing=null;scanning=false;uploading=false">{{item==='products'?'My products':item==='templates'?'Shared templates':item==='orders'?'Pickup orders':'Store settings'}}</Button></nav>
    <section v-if="tab==='products'">
     <PhotoScanner v-if="scanning" :account-id="user.id" @complete="scanned" @cancel="scanning=false" />
     <SellerProductEditor v-else-if="editing" :key="editing.id" :shoe="editing" @saved="saved" @close="editing=null;refresh()" />
     <template v-else>
      <div class="actions" style="margin-bottom:22px"><Button variant="default" class="primary" :disabled="busy" @click="scanning=true">Scan from photos</Button><Button variant="outline" :disabled="busy" @click="uploading=!uploading">Upload GLB</Button><Button variant="outline" :disabled="busy" @click="create('template')">Use KickCraft template</Button></div>
      <p class="muted" style="margin-bottom:18px">A photo scan reconstructs your actual original shoe. The template starts from KickCraft’s existing eight-part design.</p>
      <form v-if="uploading" class="panel stack" @submit.prevent="upload"><h2>Upload an original shoe</h2><p>GLB must contain 2–16 independently named material regions, at most 50,000 triangles, with embedded resources. Single-material models need photo scanning and part painting.</p><label>GLB model (up to 20 MB)<input type="file" accept=".glb,model/gltf-binary" required @change="glb=$event.target.files[0]"></label><label>Matching PNG thumbnail (up to 10 MB)<input type="file" accept="image/png" required @change="thumbnail=$event.target.files[0]"></label><Button variant="default" class="primary" :disabled="busy">{{busy?'Uploading…':'Upload product draft'}}</Button></form>
      <p v-if="!products.length&&!loading" class="panel">No products yet. Scan your shoe, upload a compatible GLB, or start with the original template.</p>
      <div class="product-list"><article v-for="shoe in products" :key="shoe.id" class="panel stack"><img class="product-image" :src="shoe.thumbnailPath" :alt="shoe.name"><p class="tag">{{shoe.publicationState}} · {{shoe.parts.length}} custom parts</p><h2>{{shoe.name}}</h2><p>₱{{Number(shoe.price).toLocaleString()}} · {{shoe.stock}} pairs</p><p v-if="shoe.reviewNote" class="notice">{{shoe.reviewNote}}</p><Button variant="outline" @click="editing=shoe">Edit product</Button></article></div>
     </template>
    </section>
    <SharedTemplateLibrary v-else-if="tab==='templates'" @created="tab='products';saved($event)" />
    <section v-else-if="tab==='orders'" class="panel stack">
     <div class="actions"><h2>Pickup orders</h2><label>Show<select v-model="orderFilter"><option value="all">All orders</option><option v-for="(label,status) in pickupLabels" :key="status" :value="status">{{label}}</option></select></label></div>
     <p v-if="!visibleOrders.length">No pickup orders in this view.</p>
     <article class="row" v-for="order in visibleOrders" :key="order.id"><div class="actions"><h3>{{order.shoeName}} · US {{order.size}}</h3><strong>{{pickupLabels[order.status]}}</strong></div><p>{{order.id}} · {{order.customerName}} · {{order.email}}<br>Pickup: {{order.pickupDate}} · ₱{{Number(order.price).toLocaleString()}}<br>{{order.pickupStore}} — {{order.pickupAddress}}</p><div class="checks"><span v-for="(color,id) in order.partColors" :key="id"><i :style="{background:color.value,display:'inline-block',width:'14px',height:'14px',border:'1px solid #bbb'}"></i> {{id}}: {{color.name}}</span><span>Charm: {{order.charmLabel || order.charmId || 'None'}}</span></div><label>Order notes / cancellation reason<textarea :value="orderNotes[order.id]??order.notes" @input="orderNotes[order.id]=$event.target.value" maxlength="2000"></textarea></label><div class="actions"><Button variant="outline" v-for="status in pickupActions[order.status] || []" :key="status" :disabled="busy" @click="status==='completed'?completing=order:updateOrder(order,status)">{{status==='approved'?'Confirm order':status==='ready'?'Mark ready':status==='completed'?'Complete pickup':'Cancel order'}}</Button></div></article>
    </section>
   </template>
   <form v-if="(profile.status!=='approved'||tab==='settings')&&profile.status!=='suspended'" class="panel stack" style="margin-top:22px" @submit.prevent="saveStore">
    <h2>Store settings</h2><p class="muted">Changing an approved store’s name or pickup address requires a new admin review. Existing orders retain their agreed pickup location.</p>
    <label>Store name<Input v-model="store.storeName" required minlength="2" maxlength="160" /></label><label>Store description<Textarea v-model="store.description" maxlength="3000"></Textarea></label><label>Pickup address<Textarea v-model="store.pickupAddress" required minlength="5" maxlength="500"></Textarea></label><label>Public contact<Input v-model="store.contact" maxlength="160" /></label><div class="actions"><Button variant="default" class="primary" :disabled="busy">{{profile.status==='rejected'?'Resubmit application':'Save store settings'}}</Button><Button variant="outline" v-if="profile.status==='approved'" type="button" @click="tutorial(0)">Restart walkthrough</Button></div>
   </form>
  </template>
  <ConfirmModal :show="!!completing" title="Complete pickup?" message="Confirm the customer collected this shoe and paid in store." confirm-text="Complete pickup" cancel-text="Keep ready" @confirm="updateOrder(completing,'completed');completing=null" @cancel="completing=null" />
 </main>
</template>
