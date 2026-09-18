const DB_NAME='kehadiran-dinas', DB_VER=1;
let db, periodStart = periodStartFor(new Date());

const SHIFT={
  PAGI:{id:'PAGI',name:'Dinas Pagi',start:'06:00',end:'14:00',midnight:false},
  SORE:{id:'SORE',name:'Dinas Sore',start:'14:00',end:'22:00',midnight:false},
  MALAM:{id:'MALAM',name:'Dinas Malam',start:'22:00',end:'06:00',midnight:true}
};
const HOLIDAYS={
  '2026-08-25':'Maulid Nabi Muhammad SAW'
};
const DAYS=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function pad(n){return String(n).padStart(2,'0')}
function iso(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseDate(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function periodStartFor(d){const x=new Date(d.getFullYear(),d.getMonth(),21);if(d.getDate()<21)x.setMonth(x.getMonth()-1);return x}
function periodEnd(){return addDays(new Date(periodStart.getFullYear(),periodStart.getMonth()+1,20),0)}
function fmt(d){return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
function fmtShort(s){const d=parseDate(s);return `${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0,3)}`}
function nowLocal(){const d=new Date();return d}
function dateTimeLocal(d){return `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`}
function openDB(){
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(DB_NAME,DB_VER);
  r.onupgradeneeded=e=>{
   const d=e.target.result;
   if(!d.objectStoreNames.contains('settings'))d.createObjectStore('settings',{keyPath:'id'});
   if(!d.objectStoreNames.contains('schedules')){const s=d.createObjectStore('schedules',{keyPath:'id'});s.createIndex('work_date','work_date')}
   if(!d.objectStoreNames.contains('attendance')){const a=d.createObjectStore('attendance',{keyPath:'id'});a.createIndex('work_date','work_date')}
  };
  r.onsuccess=()=>{db=r.result;resolve(db)};r.onerror=()=>reject(r.error)
 })
}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function get(store,key){return new Promise((res,rej)=>{const r=tx(store).get(key);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function getAll(store){return new Promise((res,rej)=>{const r=tx(store).getAll();r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
function put(store,v){return new Promise((res,rej)=>{const r=tx(store,'readwrite').put(v);r.onsuccess=()=>res(v);r.onerror=()=>rej(r.error)})}
function del(store,k){return new Promise((res,rej)=>{const r=tx(store,'readwrite').delete(k);r.onsuccess=()=>res();r.onerror=()=>rej(r.error)})}

async function init(){
 await openDB();
 let s=await get('settings','main');
 if(!s){s={id:'main',employee_name:'',tolerance:0};await put('settings',s)}
 document.querySelector('#employeeName').value=s.employee_name||'';
 document.querySelector('#tolerance').value=s.tolerance??0;
 bind();
 await renderAll();
 if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js');
}
function bind(){
 document.querySelectorAll('.bottom-nav button').forEach(b=>b.onclick=()=>showPage(b.dataset.page));
 prevPeriod.onclick=async()=>{periodStart.setMonth(periodStart.getMonth()-1);await renderAll()};
 nextPeriod.onclick=async()=>{periodStart.setMonth(periodStart.getMonth()+1);await renderAll()};
 checkInBtn.onclick=()=>attendanceAction('in');
 checkOutBtn.onclick=()=>attendanceAction('out');
 generateBtn.onclick=()=>openGenerate();
 statusFilter.onchange=renderHistory;
 exportCsv.onclick=exportCSV;
 backupBtn.onclick=backupJSON;
 restoreInput.onchange=restoreJSON;
 saveSettings.onclick=saveSettings;
 modalClose.onclick=closeModal;
}
function showPage(p){
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
 document.querySelector('#page-'+p).classList.add('active');
 document.querySelectorAll('.bottom-nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===p));
 if(p==='history')renderHistory(); if(p==='report')renderReport(); if(p==='schedule')renderSchedule();
}
async function renderAll(){periodLabel.textContent=`${fmt(periodStart)} – ${fmt(periodEnd())}`;await renderHome();await renderSchedule();await renderHistory();await renderReport()}
function statusLabel(s){return ({PRESENT:'Hadir',LATE:'Terlambat',PERMIT:'Izin',SICK:'Sakit',ABSENT:'Alpa',HOLIDAY_WORK:'Kerja Hari Libur',OFF:'Libur'})[s]||s}
function dayInfo(d){
 const s=iso(d), sunday=d.getDay()===0;
 if(HOLIDAYS[s])return {type:'HOLIDAY',label:'Libur Nasional',note:HOLIDAYS[s]};
 if(sunday)return {type:'SUNDAY',label:'Libur Minggu',note:''};
 return {type:'WORK',label:'Hari Kerja',note:''}
}
async function getSchedule(date){
 const all=await getAll('schedules');return all.find(x=>x.work_date===date)||null
}
async function getAttendance(date){const all=await getAll('attendance');return all.find(x=>x.work_date===date)||null}
async function renderHome(){
 const d=nowLocal(), s=iso(d), info=dayInfo(d), schedule=await getSchedule(s), att=await getAttendance(s);
 todayLabel.textContent=`${DAYS[d.getDay()]}, ${fmt(d)}`;
 if(info.type!=='WORK' && !schedule){
  todayShift.textContent=info.label;todayTime.textContent=info.note;
 }else{
  const sh=SHIFT[schedule?.shift_id]||null;
  todayShift.textContent=sh?.name||'Belum dijadwalkan';todayTime.textContent=sh?`${sh.start} – ${sh.end}`:'Pilih shift di Jadwal';
 }
 todayStatus.textContent=att?statusLabel(att.status):(info.type==='WORK'?'Belum absen':info.label);
 checkInBtn.disabled=!!att || (!schedule && info.type==='WORK');
 checkOutBtn.disabled=!att || !!att.check_out;
 await renderStats();
}
async function renderStats(){
 const all=await getAll('attendance');const start=periodStart,end=periodEnd();
 const arr=all.filter(a=>{const d=parseDate(a.work_date);return d>=start&&d<=end});
 const counts={PRESENT:0,LATE:0,PERMIT:0,SICK:0,ABSENT:0,HOLIDAY_WORK:0};
 arr.forEach(a=>counts[a.status]=(counts[a.status]||0)+1);
 const days=[];for(let d=new Date(start);d<=end;d=addDays(d,1))days.push(dayInfo(d));
 const sunday=days.filter(x=>x.type==='SUNDAY').length,holiday=days.filter(x=>x.type==='HOLIDAY').length;
 stats.innerHTML=[
  ['Hadir',counts.PRESENT],['Terlambat',counts.LATE],['Izin',counts.PERMIT],['Sakit',counts.SICK],['Alpa',counts.ABSENT],['Libur',sunday+holiday]
 ].map(x=>`<div class="stat"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')
}
async function renderSchedule(){
 const arr=[];for(let d=new Date(periodStart);d<=periodEnd();d=addDays(d,1)){const date=iso(d),info=dayInfo(d),sc=await getSchedule(date),sh=sc?SHIFT[sc.shift_id]:null;arr.push({d,date,info,sc,sh})}
 scheduleList.innerHTML=arr.map(x=>`
 <div class="row ${x.info.type.toLowerCase()}">
  <div class="row-top"><div><strong>${DAYS[x.d.getDay()]}, ${fmt(x.d)}</strong><div class="muted">${x.info.label}${x.info.note?' · '+x.info.note:''}</div></div><span class="tag">${x.sh?x.sh.name:x.info.type==='WORK'?'Belum diisi':'LIBUR'}</span></div>
  ${x.sh?`<div class="muted">${x.sh.start} – ${x.sh.end}${x.sh.midnight?' · lintas tanggal':''}</div>`:''}
  <div class="row-actions">${x.info.type==='WORK'?`<button onclick="editSchedule('${x.date}')">Ubah Shift</button>`:''}${x.info.type!=='WORK'?`<button onclick="workHoliday('${x.date}')">Tetap Dinas</button>`:''}</div>
 </div>`).join('')
}
function openGenerate(){
 modalTitle.textContent='Isi Shift Periode';
 modalBody.innerHTML=`<div class="form-grid">
 <label>Shift default<select id="genShift"><option value="PAGI">Dinas Pagi</option><option value="SORE">Dinas Sore</option><option value="MALAM">Dinas Malam</option></select></label>
 <label>Mode<select id="genMode"><option value="same">Gunakan shift yang sama untuk semua hari kerja</option><option value="rotate">Rotasi Pagi → Sore → Malam</option></select></label>
 <button class="primary" id="doGenerate">Generate</button></div>`;
 doGenerate.onclick=async()=>{
  let i=0;for(let d=new Date(periodStart);d<=periodEnd();d=addDays(d,1)){const info=dayInfo(d);if(info.type==='WORK'){let key=genShift.value;if(genMode.value==='rotate')key=['PAGI','SORE','MALAM'][i%3];await put('schedules',{id:'sc-'+iso(d),work_date:iso(d),shift_id:key});i++}}
  closeModal();await renderAll()
 };
 modal.classList.remove('hidden')
}
window.editSchedule=async function(date){
 const sc=await getSchedule(date);const cur=sc?.shift_id||'PAGI';
 modalTitle.textContent=`Shift ${fmtShort(date)}`;
 modalBody.innerHTML=`<div class="form-grid"><label>Shift<select id="editShift"><option value="PAGI">Dinas Pagi</option><option value="SORE">Dinas Sore</option><option value="MALAM">Dinas Malam</option></select></label><button class="primary" id="saveShift">Simpan</button></div>`;
 editShift.value=cur;saveShift.onclick=async()=>{await put('schedules',{id:'sc-'+date,work_date:date,shift_id:editShift.value});closeModal();await renderAll()};modal.classList.remove('hidden')
}
window.workHoliday=async function(date){
 const sh=await getSchedule(date);
 modalTitle.textContent=`Dinas ${fmtShort(date)}`;
 modalBody.innerHTML=`<div class="form-grid"><label>Shift<select id="holidayShift"><option value="PAGI">Dinas Pagi</option><option value="SORE">Dinas Sore</option><option value="MALAM">Dinas Malam</option></select></label><button class="primary" id="saveHoliday">Simpan</button></div>`;
 saveHoliday.onclick=async()=>{await put('schedules',{id:'sc-'+date,work_date:date,shift_id:holidayShift.value,holiday_work:true});closeModal();await renderAll()};modal.classList.remove('hidden')
}
async function attendanceAction(type){
 const d=nowLocal(),date=iso(d),sc=await getSchedule(date),info=dayInfo(d);
 if(!sc){alert('Belum ada jadwal pada tanggal ini.');return}
 let a=await getAttendance(date);
 if(type==='in'){
  const sh=SHIFT[sc.shift_id], start=new Date(`${date}T${sh.start}:00`);
  let tolerance=Number((await get('settings','main')).tolerance||0);
  if(sh.midnight===false){}
  const late=d.getTime()>start.getTime()+tolerance*60000;
  a={id:'at-'+date,work_date:date,schedule_id:sc.id,shift_id:sc.shift_id,check_in:dateTimeLocal(d),check_out:null,status:(info.type!=='WORK'||sc.holiday_work)?'HOLIDAY_WORK':(late?'LATE':'PRESENT'),late_minutes:Math.max(0,Math.floor((d-start)/60000)),notes:''};
 }else{
  if(!a){alert('Belum check-in.');return}
  a.check_out=dateTimeLocal(d)
 }
 await put('attendance',a);await renderAll()
}
async function renderHistory(){
 const filter=statusFilter.value,all=await getAll('attendance');const arr=all.filter(a=>{const d=parseDate(a.work_date);return d>=periodStart&&d<=periodEnd()&&(filter?a.status===filter:true)}).sort((a,b)=>b.work_date.localeCompare(a.work_date));
 historyList.innerHTML=arr.length?arr.map(a=>`<div class="row"><div class="row-top"><div><strong>${fmtShort(a.work_date)} · ${SHIFT[a.shift_id]?.name||a.shift_id}</strong><div class="muted">${a.check_in?.replace('T',' ' )||'-'} → ${a.check_out?.replace('T',' ')||'belum check-out'}</div></div><span class="tag">${statusLabel(a.status)}</span></div>${a.late_minutes?`<div class="muted">Terlambat ${a.late_minutes} menit</div>`:''}<div class="row-actions"><button onclick="editAttendance('${a.work_date}')">Edit</button><button class="danger" onclick="deleteAttendance('${a.id}')">Hapus</button></div></div>`).join(''):'<div class="card">Belum ada data kehadiran pada periode ini.</div>'
}
window.editAttendance=async function(date){
 const a=await getAttendance(date);if(!a)return;
 modalTitle.textContent=`Edit ${fmtShort(date)}`;
 modalBody.innerHTML=`<div class="form-grid">
 <label>Check-in<input id="editIn" type="datetime-local" value="${a.check_in?.slice(0,16)||''}"></label>
 <label>Check-out<input id="editOut" type="datetime-local" value="${a.check_out?.slice(0,16)||''}"></label>
 <label>Status<select id="editStatus">${['PRESENT','LATE','PERMIT','SICK','ABSENT','HOLIDAY_WORK'].map(x=>`<option value="${x}" ${a.status===x?'selected':''}>${statusLabel(x)}</option>`).join('')}</select></label>
 <label>Keterangan<input id="editNote" value="${a.notes||''}"></label>
 <button class="primary" id="saveAtt">Simpan</button></div>`;
 saveAtt.onclick=async()=>{a.check_in=editIn.value?editIn.value.replace('T','T') : '';a.check_out=editOut.value?editOut.value.replace('T','T'):null;a.status=editStatus.value;a.notes=editNote.value;await put('attendance',a);closeModal();await renderAll()};
 modal.classList.remove('hidden')
}
window.deleteAttendance=async function(id){if(confirm('Hapus data kehadiran ini?')){await del('attendance',id);await renderAll()}}
async function renderReport(){
 const all=await getAll('attendance');const arr=all.filter(a=>{const d=parseDate(a.work_date);return d>=periodStart&&d<=periodEnd()});
 const c={PRESENT:0,LATE:0,PERMIT:0,SICK:0,ABSENT:0,HOLIDAY_WORK:0};arr.forEach(a=>c[a.status]=(c[a.status]||0)+1);
 let work=0,sun=0,hol=0;for(let d=new Date(periodStart);d<=periodEnd();d=addDays(d,1)){const x=dayInfo(d);if(x.type==='WORK')work++;if(x.type==='SUNDAY')sun++;if(x.type==='HOLIDAY')hol++}
 report.innerHTML=`<div class="report-grid">${[['Hari kalender',31],['Hari kerja',work],['Minggu',sun],['Libur nasional',hol],['Hadir',c.PRESENT],['Terlambat',c.LATE],['Izin',c.PERMIT],['Sakit',c.SICK],['Alpa',c.ABSENT],['Kerja hari libur',c.HOLIDAY_WORK]].map(x=>`<div class="report-card"><b>${x[1]}</b><span>${x[0]}</span></div>`).join('')}</div>`
}
async function exportCSV(){
 const all=await getAll('attendance');const arr=all.filter(a=>{const d=parseDate(a.work_date);return d>=periodStart&&d<=periodEnd()});
 let csv='Tanggal,Hari,Shift,Jam Shift,Check In,Check Out,Status,Keterlambatan,Keterangan\n';
 arr.sort((a,b)=>a.work_date.localeCompare(b.work_date)).forEach(a=>{const d=parseDate(a.work_date),sh=SHIFT[a.shift_id];csv+=`${a.work_date},${DAYS[d.getDay()]},${sh?.name||''},${sh?.start||''}-${sh?.end||''},${a.check_in||''},${a.check_out||''},${statusLabel(a.status)},${a.late_minutes||0},"${(a.notes||'').replaceAll('"','""')}"\n`});
 download('kehadiran.csv','text/csv',csv)
}
async function backupJSON(){
 const data={settings:await getAll('settings'),schedules:await getAll('schedules'),attendance:await getAll('attendance'),holidays:HOLIDAYS};
 download('kehadiran-backup.json','application/json',JSON.stringify(data,null,2))
}
function download(name,type,data){const b=new Blob([data],{type}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),500)}
async function restoreJSON(e){
 const f=e.target.files[0];if(!f)return;const data=JSON.parse(await f.text());
 for(const x of data.settings||[])await put('settings',x);for(const x of data.schedules||[])await put('schedules',x);for(const x of data.attendance||[])await put('attendance',x);
 await renderAll();alert('Backup dipulihkan.')
}
async function saveSettings(){const s=await get('settings','main');s.employee_name=employeeName.value.trim();s.tolerance=Number(tolerance.value||0);await put('settings',s);alert('Pengaturan disimpan.')}
function closeModal(){modal.classList.add('hidden')}
init();
