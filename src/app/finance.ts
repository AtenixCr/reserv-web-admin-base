import { Component, Injectable, HostListener, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiFailure } from './api';
import { Identity, Locale } from './models';
import { translations } from './translations';
import { displayMoney } from './money';
type Row=Record<string,string|number|null>;
interface Snapshot {timezone:string;closureId?:string;businessDate:string;currency:string;openingFloat:string;closedAt?:string;actorName?:string;recipient?:string;locale?:string;note?:string;countedCash?:string;difference?:string;legacy?:boolean;totals:Record<string,string|number>;methods:Row[];payments:Row[];expenses:Row[];refunds:Row[];adjustments:Row[];attendance:Row[];}
interface Summary {serverDate:string;session:{id:string;businessDate:string;status:string;version:string}|null;snapshot:Snapshot|null;closureId:string|null;}
interface Cash {serverDate:string;session:{id:string;businessDate:string;canPay:boolean;status:string}|null;}
interface Pending {path:string;body:unknown;key:string;owner:string;}
@Injectable({providedIn:'root'}) export class PendingFinance {value:Pending|null=null;}
@Component({selector:'app-finance',imports:[FormsModule],templateUrl:'./finance.html',styleUrl:'./finance.css'})
export class Finance implements OnInit {
  private readonly api=inject(Api);readonly pending=inject(PendingFinance);
  readonly user=input.required<Identity>();readonly locale=input<Locale>('es');readonly sessionExpired=output<void>();readonly updated=output<void>();
  readonly busy=signal(false);readonly error=signal('');readonly success=signal('');readonly uncertain=signal(false);readonly view=signal<Summary|null>(null);readonly cash=signal<Cash|null>(null);readonly mode=signal('');readonly review=signal(false);readonly available=signal<{id:string;code:string;visitDate:string;available:string}|null>(null);readonly compensation=signal<{source:Row;amount:string;method:string}|null>(null);readonly email=signal<{status:string;attempts:number;lastErrorCode?:string}|null>(null);
  date='';dirty=false;amount='';method='CASH';category='';description='';reason='';countedCash='';note='';openingFloat='0.00';sourceType='';sourceId='';
  readonly sections=['payments','expenses','refunds','adjustments','attendance'] as const;
  readonly moneyKeys=['payments','additionalPayments','compensations','expenses','refunds','operatingResult','expectedCash'];readonly counts=['adults','children','seniors','vehicles'];
  t(key:string):string{return translations[this.locale()][key]||key;}
  text(value:unknown):string{return value===null||value===undefined?'':String(value);}
  money(value:unknown):string{const s=this.text(value)||'0.00';return (s.startsWith('-')?'−':'')+displayMoney(s.replace(/^-/,'')||'0.00','CRC',this.locale());}
  timestamp(value:unknown):string{const text=this.text(value);if(!text)return '';const date=new Date(text);return Number.isNaN(date.getTime())?text:new Intl.DateTimeFormat(this.locale(),{timeZone:'America/Costa_Rica',dateStyle:'medium',timeStyle:'short'}).format(date);}
  private cents(value:string):bigint{if(!/^-?[0-9]{1,17}(\.[0-9]{1,2})?$/.test(value))return 0n;const [whole,fraction='']=value.replace(/^-/,'').split('.');return (BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0')))*(value.startsWith('-')?-1n:1n);}
  difference():string{const value=this.cents(this.countedCash)-this.cents(this.text(this.view()?.snapshot?.totals['expectedCash']));const abs=value<0n?-value:value;return `${value<0n?'-':''}${abs/100n}.${(abs%100n).toString().padStart(2,'0')}`;}
  canPay():boolean{return !!this.cash()?.session?.canPay;}
  canLeave():boolean{if(this.busy()||this.uncertain())return false;return !this.dirty||window.confirm(this.t('discard'));}
  private fail(e:unknown):void{this.error.set(e instanceof ApiFailure?e.code:'UNEXPECTED_ERROR');if(e instanceof ApiFailure&&e.status===401){this.api.reset();this.sessionExpired.emit();}queueMicrotask(()=>document.getElementById('finance-feedback')?.focus());}
  async ngOnInit():Promise<void>{this.uncertain.set(!!this.pending.value);if(this.pending.value)this.error.set('UNCERTAIN_OPERATION');await this.load();}
  async load():Promise<void>{this.busy.set(true);try{const cash=await this.api.request<Cash>('/cash-sessions/current');this.cash.set(cash);if(!this.date)this.date=cash.session?.businessDate||cash.serverDate;const view=await this.api.request<Summary>('/finance/summary?date='+encodeURIComponent(this.date));this.view.set(view);this.email.set(null);if(view.closureId){const closure=await this.api.request<{email:{status:string;attempts:number;lastErrorCode?:string}}>('/closures/'+view.closureId);this.email.set(closure.email);}}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async chooseDate():Promise<void>{if(!this.canLeave())return;this.reset();await this.load();}
  async currentDate():Promise<void>{if(!this.canLeave())return;this.date=this.cash()?.session?.businessDate||this.cash()?.serverDate||'';this.reset();await this.load();}
  private reset():void{this.mode.set('');this.review.set(false);this.dirty=false;this.error.set('');this.success.set('');}
  start(mode:string):boolean{if(!this.canLeave())return false;this.reset();this.mode.set(mode);this.amount='';this.method='CASH';this.category='';this.description='';this.reason='';this.countedCash='';this.note='';this.available.set(null);this.compensation.set(null);return true;}
  changed():void{this.dirty=true;this.review.set(false);this.error.set('');}
  cancel():void{if(this.canLeave())this.reset();}
  async refund(row:Row):Promise<void>{if(!this.start('refund'))return;this.busy.set(true);try{this.available.set(await this.api.request(`/finance/admissions/${row['admissionId']}/refundable`));}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  beginCompensation(section:string,row:Row):void{if(!this.start('compensation'))return;this.sourceType=section==='expenses'?'EXPENSE':section==='refunds'?'REFUND':'ADJUSTMENT';this.sourceId=this.text(row['id']);}
  private compensationBody():unknown{return {sourceType:this.sourceType,sourceId:this.sourceId,reason:this.reason};}
  async prepare():Promise<void>{if(this.busy()||this.uncertain())return;this.error.set('');if(this.mode()==='compensation'){this.busy.set(true);try{this.compensation.set(await this.api.request('/adjustments/quotes','POST',this.compensationBody()));this.review.set(true);}catch(e){this.fail(e);}finally{this.busy.set(false);}}else this.review.set(true);}
  async submit():Promise<void>{if(this.busy()||this.uncertain()||!this.review())return;let path='',body:unknown;
    if(this.mode()==='expense'){path='/expenses';body={amount:this.amount,method:this.method,category:this.category,description:this.description};}
    else if(this.mode()==='refund'){path='/refunds';body={admissionId:this.available()!.id,amount:this.amount,method:this.method,reason:this.reason};}
    else if(this.mode()==='compensation'){path='/adjustments';body=this.compensationBody();}
    else{path=`/cash-sessions/${this.view()!.session!.id}/close`;body={version:this.view()!.session!.version,countedCash:this.countedCash,note:this.note||null,locale:this.locale()};}
    this.pending.value={path,body,key:crypto.randomUUID(),owner:this.user().id};await this.recover();
  }
  async recover():Promise<void>{const pending=this.pending.value;if(!pending||this.busy())return;if(pending.owner!==this.user().id){this.error.set('OPERATION_OWNER_REQUIRED');return;}this.busy.set(true);this.error.set('');try{await this.api.request(pending.path,'POST',pending.body,{'Idempotency-Key':pending.key});this.pending.value=null;this.uncertain.set(false);this.reset();this.success.set('operationSaved');this.updated.emit();await this.load();}catch(e){const uncertain=!(e instanceof ApiFailure)||e.status===0||e.status>=500||e.status===401||e.code==='IDEMPOTENCY_CONFLICT';this.uncertain.set(uncertain);if(!uncertain){this.pending.value=null;this.review.set(false);if(e instanceof ApiFailure&&e.status===409)await this.load();}this.fail(e);}finally{this.busy.set(false);}}
  cancelOpening():void{if(!this.canLeave())return;this.reset();this.openingFloat='0.00';}
  async openCash():Promise<void>{if(this.busy()||this.uncertain())return;this.busy.set(true);try{await this.api.request('/cash-sessions','POST',{openingFloat:this.openingFloat});this.reset();this.date=this.cash()!.serverDate;this.openingFloat='0.00';this.success.set('cashOpened');await this.load();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async download(format:string):Promise<void>{if(this.busy()||!this.view()?.closureId)return;this.busy.set(true);this.error.set('');try{await this.api.download(`/closures/${this.view()!.closureId}/report?format=${format}`,`closure-${this.view()!.closureId}.${format}`);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async retryEmail():Promise<void>{if(this.busy())return;this.busy.set(true);try{const result=await this.api.request<{email:{status:string;attempts:number}}>(`/closures/${this.view()!.closureId}/email`,'POST',{});this.email.set(result.email);this.success.set('emailRetryQueued');}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  rows(section:typeof this.sections[number]):Row[]{return this.view()?.snapshot?.[section]||[];}
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent):void{if(this.dirty||this.uncertain()){event.preventDefault();event.returnValue='';}}
}
