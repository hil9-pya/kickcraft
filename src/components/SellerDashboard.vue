<script setup>
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import {ref,reactive,computed,onMounted,onBeforeUnmount} from 'vue'
import {api} from '../api.js'
import {thumbnailFromGlb} from '../glb-thumbnail.js'
import {validateStore,pickupActions,pickupLabels,productLabels} from '../seller.js'
import {forgetCompletedScan} from '../scan-capture.js'
import PhotoScanner from './PhotoScanner.vue'
import ConfirmModal from './ConfirmModal.vue'
import ShoeThumbnail from './ShoeThumbnail.vue'
import SharedTemplateLibrary from './SharedTemplateLibrary.vue'
import SellerProductEditor from './SellerProductEditor.vue'
import '../seller.css'
const props=defineProps({user:{type:Object,required:true}})
const emit=defineEmits(['changed','signedOut'])
const profile=ref(null),products=ref([]),orders=ref([]),tab=ref('products'),editing=ref(null),scanning=ref(false),uploading=ref(false),busy=ref(false),loading=ref(true),error=ref(''),message=ref('')
const store=reactive({storeName:'',description:'',pickupAddress:'',contact:''}),glb=ref(null),thumbnail=ref(null)
const autoThumbnail=ref(null),thumbnailUrl=ref(''),thumbnailPreparing=ref(false),uploadSelection=ref(0)
const completing=ref(null),leaving=ref(null),productAction=ref(null),productView=ref('active')
const visibleProducts=computed(()=>products.value.filter(shoe=>productView.value==='archived'?!!shoe.deletedAt:!shoe.deletedAt))
const orderFilter=ref('all'),orderNotes=reactive({})
const visibleOrders=computed(()=>orders.value.filter(o=>orderFilter.value==='all'||o.status===orderFilter.value))
const guideSteps=[{title:'Your store is approved',text:'Customers see your store name and pickup address. Check these under Store settings.',tab:'settings'},{title:'Create a shoe',text:'Use Generate from photos for your actual shoe. Choose one clear photo or up to four labeled views. Remove backgrounds if needed, then generate a model.',tab:'products'},{title:'Make parts customizable',text:'Compare the scan against the photographs. Paint at least two real shoe regions, name them, then test each color in Product details.',tab:'products'},{title:'Request listing review',text:'Set description, price, stock, sizes and palette. Submit for review. Only admin-approved listings appear publicly.',tab:'products'},{title:'Fulfill pickup orders',text:'Confirm each reservation, mark it ready, then complete it after collection and payment in your store. Cancellation restores one pair.',tab:'orders'}]
const guide=computed(()=>guideSteps[profile.value?.tutorialStep || 0])
const reviewNotices=ref([])
let timer,closed=false,refreshing=false
async function refresh(quiet=false) {
 if(closed||refreshing)return
 refreshing=true
 if(!quiet)loading.value=true
 try {
  const result=await api('sellers/profile.php');const previous=profile.value?.status;profile.value=result.seller
  if(!quiet||previous!==profile.value.status)Object.assign(store,result.seller)
  if(profile.value.status==='approved') {
   const results=await Promise.all([api('products/list.php?include_archived=1'),api('sellers/orders.php')]);if(closed)return
   const prior=new Map(products.value.map(shoe=>[shoe.id,shoe.publicationState+Boolean(shoe.deletedAt)]))
   const changed=results[0].shoes.filter(shoe=>prior.has(shoe.id)&&prior.get(shoe.id)!==shoe.publicationState+Boolean(shoe.deletedAt))
   const notices=changed.filter(shoe=>!shoe.deletedAt&&['approved','rejected'].includes(shoe.publicationState)).map(shoe=>shoe.publicationState==='approved'?`Admin approved ${shoe.name}. It is now live in Shop.`:`Admin requested changes to ${shoe.name}. ${shoe.reviewNote||'Open the product to see review details.'}`)
   if(changed.length){reviewNotices.value=notices.slice(0,5);emit('changed')}
   products.value=results[0].shoes;orders.value=results[1].reservations
   if(editing.value){const updated=products.value.find(shoe=>shoe.id===editing.value.id);if(updated){editing.value.publicationState=updated.publicationState;editing.value.reviewNote=updated.reviewNote}}
  }else {products.value=[];orders.value=[];reviewNotices.value=[];editing.value=null;scanning.value=false;uploading.value=false}
  if(!quiet)error.value=''
 }catch(cause){error.value=cause.message;if(cause.status===401)emit('signedOut')}
 finally{loading.value=false;refreshing=false}
}
async function changeProductVisibility(shoe,action){
 if(busy.value)return
 busy.value=true;error.value=''
 try{
  const result=await api('products/visibility.php',{method:'POST',body:{id:shoe.id,action}})
  products.value=products.value.map(item=>item.id===shoe.id?result.shoe:item)
  productAction.value=null;reviewNotices.value=[]
  message.value=action==='archive'?'Product removed. Restore it from Removed products. Existing pickup orders are unchanged.':action==='restore'?'Product restored as a private draft. Submit it for admin review to publish again.':'Product unpublished. It remains in My products as a private draft.'
  emit('changed');await refresh()
 }catch(cause){error.value=cause.message}finally{busy.value=false}
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
function clearUploadThumbnail(){
 uploadSelection.value++;thumbnailPreparing.value=false;autoThumbnail.value=null
 if(thumbnailUrl.value)URL.revokeObjectURL(thumbnailUrl.value)
 thumbnailUrl.value=''
}
function showUploadThumbnail(image){
 if(thumbnailUrl.value)URL.revokeObjectURL(thumbnailUrl.value)
 thumbnailUrl.value=image?URL.createObjectURL(image):''
}
async function chooseGlb(event){
 clearUploadThumbnail();thumbnail.value=null;glb.value=event.target.files?.[0]||null;error.value=''
 if(!glb.value)return
 if(!glb.value.name.toLowerCase().endsWith('.glb')||!glb.value.size||glb.value.size>20*1024*1024){error.value='Choose a GLB model up to 20 MB.';glb.value=null;return}
 const selection=uploadSelection.value;thumbnailPreparing.value=true
 try{
  const image=await thumbnailFromGlb(glb.value)
  if(closed||selection!==uploadSelection.value)return
  autoThumbnail.value=image;showUploadThumbnail(image)
 }catch(cause){if(!closed&&selection===uploadSelection.value)error.value='Automatic thumbnail failed: '+cause.message+' You can choose a custom PNG instead.'}
 finally{if(selection===uploadSelection.value)thumbnailPreparing.value=false}
}
function chooseThumbnail(event){
 const file=event.target.files?.[0]||null;error.value=''
 if(file&&(file.type!=='image/png'||file.size>10*1024*1024)){error.value='Choose a PNG thumbnail up to 10 MB.';event.target.value='';thumbnail.value=null;showUploadThumbnail(autoThumbnail.value);return}
 thumbnail.value=file;showUploadThumbnail(file||autoThumbnail.value)
}
async function upload() {
 if(busy.value||thumbnailPreparing.value)return
 const image=thumbnail.value||autoThumbnail.value
 if(!glb.value||!image){error.value='Choose a GLB and wait for its thumbnail, or choose a custom PNG.';return}
 if(glb.value.size>20*1024*1024||image.size>10*1024*1024){error.value='GLB limit: 20 MB. Thumbnail limit: 10 MB.';return}
 busy.value=true;error.value=''
 try{const body=new FormData();body.append('file',glb.value);body.append('thumbnail',image,'thumbnail.png');const result=await api('products/upload.php',{method:'POST',body});editing.value=result.shoe;uploading.value=false;glb.value=null;thumbnail.value=null;clearUploadThumbnail();await refresh()}
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
function navigate(item){tab.value=item;editing.value=null;scanning.value=false;uploading.value=false;leaving.value=null}
function saved(shoe){editing.value=shoe;refresh();emit('changed')}
function poll(){if(!document.hidden&&!busy.value)void refresh(true)}
onMounted(async()=>{await refresh();if(closed)return;timer=setInterval(poll,15000);document.addEventListener('visibilitychange',poll)})
onBeforeUnmount(()=>{closed=true;clearUploadThumbnail();clearInterval(timer);document.removeEventListener('visibilitychange',poll)})
</script>
<template>
 <main class="seller seller-portal">
  <header><div><p class="portal-title">Seller Studio</p><h1>{{profile?.storeName || 'Your store'}}</h1></div><div class="actions"><a href="#shop">Shop</a><Button variant="outline" :disabled="loading||busy" @click="refresh()">Refresh</Button></div></header>
  <p v-if="loading" role="status">Loading Seller Studio…</p><p v-if="error" class="error" role="alert">{{error}}</p><p v-if="message" class="success" role="status">{{message}}</p>
  <section v-if="reviewNotices.length" class="success" role="status" aria-live="polite"><div class="actions"><strong>Admin review updates</strong><Button type="button" variant="ghost" @click="reviewNotices=[]">Dismiss</Button></div><p v-for="notice in reviewNotices" :key="notice">{{notice}}</p></section>
  <div v-if="profile" class="seller-layout" :class="{'without-navigation':profile.status!=='approved'}">
   <nav v-if="profile.status==='approved'" class="seller-navigation" aria-label="Seller sections"><Button variant="outline" v-for="item in ['products','templates','orders','settings']" :key="item" :aria-current="tab===item" :disabled="busy||loading" @click="tab!==item&&(editing||scanning||uploading?leaving=item:navigate(item))">{{item==='products'?'My products':item==='templates'?'Shared templates':item==='orders'?'Pickup orders':'Store settings'}}</Button></nav>
   <div class="seller-workspace">
   <template v-if="profile.status!=='approved'">
    <section class="notice stack"><h2>{{profile.status==='pending'?'Application awaiting admin review':profile.status==='rejected'?'Application needs changes':'Store suspended'}}</h2><p>{{profile.status==='pending'?'You can sign in and update your store. Product creation and order management unlock after approval.':profile.status==='rejected'?'Correct the store details below, then resubmit your application.':'Contact the owner about the review note. Listings are hidden while your store is suspended.'}}</p><p v-if="profile.reviewNote"><strong>Admin note:</strong> {{profile.reviewNote}}</p></section>
   </template>
   <template v-else>
    <details v-if="guide&&!editing&&!scanning" class="tutorial" aria-label="Seller walkthrough" open><summary>Getting started · {{profile.tutorialStep+1}} / 5</summary><div class="stack"><div class="actions"><Button variant="ghost" @click="tutorial(5)">Dismiss walkthrough</Button></div><h3>{{guide.title}}</h3><p>{{guide.text}}</p><div class="actions"><Button variant="outline" @click="tab=guide.tab">Show {{guide.tab==='orders'?'pickup orders':guide.tab==='settings'?'store settings':'products'}}</Button><Button variant="default" class="primary" @click="tutorial(profile.tutorialStep+1)">{{profile.tutorialStep===4?'Finish walkthrough':'Next step'}}</Button></div></div></details>
    <section v-if="tab==='products'">
     <PhotoScanner v-if="scanning" :account-id="user.id" @complete="scanned" @cancel="scanning=false" />
     <SellerProductEditor v-else-if="editing" :key="editing.id" :shoe="editing" @saved="saved" @close="editing=null;refresh()" />
     <template v-else>
      <div class="workspace-heading"><div><h2>My products</h2><p class="muted">Original shoes, prepared for customer customization.</p></div><div class="actions"><Button variant="default" class="primary" :disabled="busy" @click="scanning=true">Generate from photos</Button><Button variant="outline" :disabled="busy" @click="uploading=!uploading">Upload GLB</Button><Button variant="outline" :disabled="busy" @click="create('template')">Use KickCraft template</Button></div></div>
      <p class="muted creation-help">Create a 3D draft from 1–4 photos; compare every angle because unseen details may differ. The template starts from KickCraft’s existing eight-part design.</p>
      <form v-if="uploading" class="panel stack upload-form" @submit.prevent="upload">
       <h2>Upload an original shoe</h2><p>GLB must contain 2–16 independently named material regions, at most 50,000 triangles, with embedded resources. Single-material models need photo generation and part painting.</p>
       <div class="glb-upload-layout">
        <fieldset class="stack" :disabled="busy||thumbnailPreparing">
         <label>GLB model (up to 20 MB)<input type="file" accept=".glb,model/gltf-binary" required @change="chooseGlb"></label>
         <p class="muted">A thumbnail is generated automatically from your model.</p>
         <label>Custom PNG thumbnail (optional, up to 10 MB)<input :key="uploadSelection" type="file" accept="image/png" @change="chooseThumbnail"></label>
        </fieldset>
        <div class="glb-upload-preview"><img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Selected shoe thumbnail preview"><p v-else role="status">{{thumbnailPreparing?'Preparing thumbnail…':'Thumbnail preview appears after selecting a GLB.'}}</p><small v-if="thumbnailUrl">{{thumbnail?'Custom thumbnail':'Automatic thumbnail'}}</small></div>
       </div>
       <Button variant="default" class="primary" :disabled="busy||thumbnailPreparing||!glb||(!thumbnail&&!autoThumbnail)">{{thumbnailPreparing?'Preparing thumbnail…':busy?'Uploading…':'Upload product draft'}}</Button>
      </form>
      <div class="actions mb-4" role="group" aria-label="Product visibility"><Button variant="outline" :aria-pressed="productView==='active'" @click="productView='active'">Active products</Button><Button variant="outline" :aria-pressed="productView==='archived'" @click="productView='archived'">Removed products</Button></div>
      <p v-if="!visibleProducts.length&&!loading" class="panel empty-products">{{productView==='archived'?'No removed products.':'No products yet. Generate from photos, upload a compatible GLB, or use a template.'}}</p>
      <div class="product-list"><article v-for="shoe in visibleProducts" :key="shoe.id" class="panel stack seller-product-card"><ShoeThumbnail :src="shoe.glbPath" :image="shoe.thumbnailPath" :alt="shoe.name" /><p class="tag">{{shoe.deletedAt?'Removed — hidden from Shop':productLabels[shoe.publicationState] || shoe.publicationState}} · {{shoe.parts.length}} custom parts</p><h2>{{shoe.name}}</h2><p>₱{{Number(shoe.price).toLocaleString()}} · {{shoe.stock}} pairs</p><p v-if="shoe.reviewNote" class="notice">{{shoe.reviewNote}}</p>
       <footer class="seller-product-actions"><Button v-if="shoe.deletedAt" variant="outline" :disabled="busy||loading" @click="changeProductVisibility(shoe,'restore')">Restore draft</Button>
       <template v-else><Button variant="outline" :disabled="busy||loading" @click="editing=shoe">{{shoe.publicationState==='approved'?'Edit approved shoe':'Edit product'}}</Button><div class="seller-product-secondary"><Button v-if="['approved','pending'].includes(shoe.publicationState)" variant="outline" :disabled="busy||loading" @click="productAction={shoe,action:'unpublish'}">Unpublish</Button><Button variant="outline" class="seller-product-remove text-destructive" :disabled="busy||loading" @click="productAction={shoe,action:'archive'}">Remove</Button></div></template></footer>
      </article></div>
     </template>
    </section>
    <SharedTemplateLibrary v-else-if="tab==='templates'" @created="tab='products';saved($event)" />
    <section v-else-if="tab==='orders'" class="order-workspace stack">
     <div class="workspace-heading"><div><h2>Pickup orders</h2><p class="muted">{{visibleOrders.length}} {{visibleOrders.length===1?'order':'orders'}} in this view</p></div><label class="order-filter">Status<select v-model="orderFilter"><option value="all">All orders</option><option v-for="(label,status) in pickupLabels" :key="status" :value="status">{{label}}</option></select></label></div>
     <p v-if="!visibleOrders.length" class="panel empty-products">No pickup orders in this view.</p>
     <article class="order-card panel" v-for="order in visibleOrders" :key="order.id">
      <header class="order-heading"><div><p class="muted">{{order.id}}</p><h3>{{order.shoeName}} <span class="muted">· US {{order.size}}</span></h3></div><div class="order-state"><strong>₱{{Number(order.price).toLocaleString()}}</strong><span class="order-status" :data-status="order.status">{{pickupLabels[order.status]}}</span></div></header>
      <div class="order-information">
       <div class="stack order-customer"><div><p class="muted">Customer</p><p><strong>{{order.customerName}}</strong></p><p>{{order.email}}</p></div><details class="order-design"><summary>Design details</summary><div class="order-colors"><span v-for="(color,id) in order.partColors" :key="id"><i aria-hidden="true" :style="{background:color.value}"></i>{{id}}: {{color.name}}</span><span>Charm: {{order.charmLabel || order.charmId || 'None'}}</span></div></details></div>
       <div class="order-pickup"><p class="muted">Pickup date</p><p><strong>{{order.pickupDate}}</strong></p><p class="order-store">{{order.pickupStore}}</p><p class="muted">{{order.pickupAddress}}</p></div>
       <div class="stack order-controls"><label>Order notes / cancellation reason<Textarea :model-value="orderNotes[order.id]??order.notes" @update:model-value="orderNotes[order.id]=$event" maxlength="2000" /></label><div v-if="pickupActions[order.status]?.length" class="order-actions"><Button v-for="status in pickupActions[order.status] || []" :key="status" :variant="status==='cancelled'?'outline':'default'" :class="{'text-destructive':status==='cancelled'}" :disabled="busy" @click="status==='completed'?completing=order:updateOrder(order,status)">{{status==='approved'?'Confirm order':status==='ready'?'Mark ready':status==='completed'?'Complete pickup':'Cancel order'}}</Button></div></div>
      </div>
     </article>
    </section>
   </template>
   <form v-if="(profile.status!=='approved'||tab==='settings')&&profile.status!=='suspended'" class="panel stack store-settings" @submit.prevent="saveStore">
    <h2>Store settings</h2><p class="muted">Changing an approved store’s name or pickup address requires a new admin review. Existing orders retain their agreed pickup location.</p>
    <label>Store name<Input v-model="store.storeName" required minlength="2" maxlength="160" /></label><label>Store description<Textarea v-model="store.description" maxlength="3000"></Textarea></label><label>Pickup address<Textarea v-model="store.pickupAddress" required minlength="5" maxlength="500"></Textarea></label><label>Public contact<Input v-model="store.contact" maxlength="160" /></label><div class="actions"><Button variant="default" class="primary" :disabled="busy">{{profile.status==='rejected'?'Resubmit application':'Save store settings'}}</Button><Button variant="outline" v-if="profile.status==='approved'" type="button" @click="tutorial(0)">Restart walkthrough</Button></div>
   </form>
   </div>
  </div>
  <ConfirmModal :show="!!productAction" :title="productAction?.action==='archive'?'Remove product?':'Unpublish product?'" :message="productAction?.action==='archive'?`Remove ${productAction?.shoe.name} from your active products and Shop? You can restore it later. Existing pickup orders stay unchanged.`:`Hide ${productAction?.shoe.name} from Shop and cancel any pending review? It remains a private draft. Publishing again requires admin approval.`" :confirm-text="productAction?.action==='archive'?'Remove product':'Unpublish'" cancel-text="Keep product" @confirm="changeProductVisibility(productAction.shoe,productAction.action)" @cancel="!busy&&(productAction=null)" />
  <ConfirmModal :show="!!leaving" title="Leave product workspace?" message="Unsaved product or painting changes will be lost. Saved drafts and captures stay available." confirm-text="Leave workspace" cancel-text="Keep editing" @confirm="navigate(leaving)" @cancel="leaving=null" />
  <ConfirmModal :show="!!completing" title="Complete pickup?" message="Confirm the customer collected this shoe and paid in store." confirm-text="Complete pickup" cancel-text="Keep ready" @confirm="updateOrder(completing,'completed');completing=null" @cancel="completing=null" />
 </main>
</template>
