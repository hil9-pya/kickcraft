<script setup>
import {reactive,ref} from 'vue'
import {api} from '../api.js'
import {validateSeller} from '../seller.js'
import '../seller.css'
const props=defineProps({register:{type:Boolean,default:false}})
const emit=defineEmits(['authenticated'])
const form=reactive({name:'',email:'',password:'',confirmPassword:'',storeName:'',description:'',pickupAddress:'',contact:''})
const error=ref(''),message=ref(''),busy=ref(false)
async function submit() {
 error.value='';message.value=''
 if(props.register){error.value=validateSeller(form);if(error.value)return}
 busy.value=true
 try {
  if(props.register){await api('auth/register.php',{method:'POST',body:form});form.password='';form.confirmPassword='';message.value='Application saved. Sign in to check admin review. Product creation unlocks after approval.'}
  else {const result=await api('auth/login.php',{method:'POST',body:{email:form.email,password:form.password}});emit('authenticated',result.user)}
 }catch(cause){error.value=cause.message}finally{busy.value=false}
}
</script>
<template>
 <main class="seller" style="max-width:760px">
  <header><div><p class="tag">KickCraft Seller Studio</p><h1>{{register?'Apply to sell':'Seller sign in'}}</h1></div><a href="#shop">Back to shop</a></header>
  <p class="muted" style="margin-bottom:22px">Sell original shoes with customizable 3D parts. Admin reviews your store and each listing. Customers reserve for pickup and pay at your store.</p>
  <p v-if="error" role="alert" class="error">{{error}}</p><p v-if="message" role="status" class="success">{{message}}</p>
  <form class="panel stack" @submit.prevent="submit" :aria-busy="busy">
   <div class="fields">
    <label v-if="register">Full name<input v-model="form.name" autocomplete="name" required maxlength="160"></label>
    <label>Email address<input v-model.trim="form.email" type="email" autocomplete="email" required maxlength="254"></label>
    <label>Password<input v-model="form.password" type="password" :autocomplete="register?'new-password':'current-password'" required :minlength="register?10:1" maxlength="72"><small v-if="register">At least 10 characters; use a unique password.</small></label>
    <label v-if="register">Confirm password<input v-model="form.confirmPassword" type="password" autocomplete="new-password" required maxlength="72"></label>
    <template v-if="register">
     <label class="wide">Store name<input v-model="form.storeName" required minlength="2" maxlength="160"></label>
     <label class="wide">Store description<textarea v-model="form.description" maxlength="3000"></textarea></label>
     <label class="wide">Pickup address<textarea v-model="form.pickupAddress" required minlength="5" maxlength="500" autocomplete="street-address" placeholder="Complete address where customers collect shoes"></textarea></label>
     <label class="wide">Public store contact (optional)<input v-model="form.contact" maxlength="160" placeholder="Phone number or store contact details"></label>
    </template>
   </div>
   <div class="actions"><button class="primary" :disabled="busy">{{busy?'Please wait…':register?'Submit seller application':'Sign in'}}</button><a :href="register?'#seller':'#seller-register'">{{register?'Already applied? Sign in':'New seller? Apply here'}}</a></div>
  </form>
 </main>
</template>
