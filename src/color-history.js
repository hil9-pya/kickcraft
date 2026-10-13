import {ref} from 'vue'
const key='kickcraft_recent_colors'
export function readRecentColors(storage){
 if(storage===undefined&&typeof window==='undefined')return []
 try{const saved=JSON.parse((storage??globalThis.localStorage)?.getItem(key)||'[]');return Array.isArray(saved)?[...new Set(saved.filter(value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)).map(value=>value.toLowerCase()))].slice(0,8):[]}catch{return []}
}
export const recentColors=ref(readRecentColors())
export function rememberColor(value,storage){
 if(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value))return
 recentColors.value=[...new Set([value.toLowerCase(),...recentColors.value,...readRecentColors(storage)])].slice(0,8)
 try{(storage??globalThis.localStorage)?.setItem(key,JSON.stringify(recentColors.value))}catch{}
}
