import { Component, Injectable, HostListener, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KeyValuePipe } from '@angular/common';
import { Api, ApiFailure } from './api';
import { Locale, Identity } from './models';
import { translations } from './translations';
import { displayMoney } from './money';
export interface Quote {visitDate:string;rateVersion:string;currency:string;lines:{category:string;quantity:number;unitPrice:string;subtotal:string}[];total:string;hours:unknown[];}
export interface Group {id:string;code:string;name:string|null;email:string|null;phone:string|null;note:string|null;visitDate:string;version:string;status:string;adults:number;children:number;seniors:number;vehicles:number;locale?:Locale;reservationId?:string|null;quote:Quote;payment?:{method:string;amount:string;receivedAmount:string|null;changeAmount:string|null;reference:string|null}|null;revisions?:{id:string;difference:string;reason:string;createdAt:string;adults:number;children:number;seniors:number;vehicles:number}[];}
interface Page {items:Group[];page:number;size:number;total:number;}
interface Cash {serverDate:string;session:{id:string;businessDate:string;status:string;canPay:boolean;openingFloat?:string}|null;}
interface Pending {path:string;body:unknown;key:string;owner:string;}
@Injectable({providedIn:'root'})
export class PendingOperation {value:Pending|null=null;}
@Component({selector:'app-operations',imports:[FormsModule,KeyValuePipe],templateUrl:'./operations.html',styleUrl:'./operations.css'})
export class Operations implements OnInit {
  private readonly api=inject(Api);
  readonly pending=inject(PendingOperation);
  readonly user=input.required<Identity>();readonly locale=input<Locale>('es');readonly updated=output<void>();readonly sessionExpired=output<void>();
  readonly busy=signal(false);readonly error=signal('');readonly fields=signal<Record<string,string>>({});readonly success=signal('');readonly uncertain=signal(false);
  readonly cash=signal<Cash|null>(null);readonly reservations=signal<Page|null>(null);readonly admissions=signal<Page|null>(null);readonly selected=signal<Group|null>(null);readonly selectedKind=signal('');readonly mode=signal('');readonly quote=signal<Quote|null>(null);readonly difference=signal('0.00');
  date='';search='';page=0;openingFloat='0.00';openingDirty=false;dirty=false;paymentMethod='CASH';receivedAmount='';reference='';reason='';
  draft={visitDate:'',name:'',email:'',phone:'',note:'',adults:1,children:0,seniors:0,vehicles:0,locale:'es' as Locale};
  readonly counts=['adults','children','seniors','vehicles'] as const;readonly contacts=['name','email','phone'] as const;
  t(key:string):string{return translations[this.locale()][key]||key;}
  money(value:string):string{return (value.startsWith('-')?'−':'')+displayMoney(value.replace(/^-/,'')||'0.00','CRC',this.locale());}
  private cents(value:string):bigint{if(!/^[0-9]{1,17}(\.[0-9]{1,2})?$/.test(value))return 0n;const [whole,fraction='']=value.split('.');return BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));}
  private decimal(value:bigint):string{return `${value/100n}.${(value%100n).toString().padStart(2,'0')}`;}
  payable():string{return this.mode()==='correction'?this.difference():this.quote()?.total||'0.00';}
  change():string{const amount=this.payable();if(amount.startsWith('-')||this.paymentMethod!=='CASH')return '0.00';const diff=this.cents(this.receivedAmount)-this.cents(amount);return this.decimal(diff>0n?diff:0n);}
  tomorrow():string{const d=new Date((this.cash()?.serverDate||'2000-01-01')+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
  async ngOnInit():Promise<void>{this.uncertain.set(!!this.pending.value);if(this.pending.value)this.error.set('UNCERTAIN_OPERATION');await this.load();}
  private fail(e:unknown):void{this.error.set(e instanceof ApiFailure?e.code:'UNEXPECTED_ERROR');this.fields.set(e instanceof ApiFailure?e.fields:{});if(e instanceof ApiFailure&&e.status===401){this.api.reset();this.sessionExpired.emit();}queueMicrotask(()=>document.getElementById('operations-feedback')?.focus());}
  canLeave():boolean{if(this.busy()||this.uncertain())return false;if((this.dirty||this.openingDirty)&&!window.confirm(this.t('discard')))return false;return true;}
  async load():Promise<void>{this.busy.set(true);try{const c=await this.api.request<Cash>('/cash-sessions/current');this.cash.set(c);if(!this.date)this.date=c.serverDate;const query=`?date=${encodeURIComponent(this.date)}&search=${encodeURIComponent(this.search)}&page=${this.page}&size=20`;const [r,a]=await Promise.all([this.api.request<Page>('/reservations'+query),this.api.request<Page>('/admissions'+query)]);this.reservations.set(r);this.admissions.set(a);}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async searchGroups():Promise<void>{this.page=0;await this.load();}
  async clearSearch():Promise<void>{this.search='';this.date=this.cash()?.serverDate||'';this.page=0;await this.load();}
  async paginate(delta:number):Promise<void>{this.page+=delta;await this.load();}
  more():boolean{return Math.max(this.reservations()?.total||0,this.admissions()?.total||0)>(this.page+1)*20;}
  changed():void{this.dirty=true;this.quote.set(null);this.error.set('');this.fields.set({});}
  async select(item:Group,kind:string):Promise<void>{if(!this.canLeave())return;this.busy.set(true);try{this.selected.set(await this.api.request<Group>(`/${kind}/${item.id}`));this.selectedKind.set(kind);this.mode.set('');this.quote.set(null);this.dirty=false;this.error.set('');this.success.set('');}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  start(mode:string):void{if(!this.canLeave())return;this.mode.set(mode);this.quote.set(null);this.error.set('');this.success.set('');this.fields.set({});this.reason='';this.receivedAmount='';this.reference='';this.paymentMethod='CASH';this.dirty=false;
    const g=this.selected();if(['checkin','editReservation','contact','correction','cancelReservation','noShow'].includes(mode)&&g){this.draft={visitDate:g.visitDate,name:g.name||'',email:g.email||'',phone:g.phone||'',note:g.note||'',adults:g.adults,children:g.children,seniors:g.seniors,vehicles:g.vehicles,locale:g.locale||this.locale()};}
    else {this.selected.set(null);this.draft={visitDate:mode==='reservation'?(this.date>=(this.tomorrow())?this.date:this.tomorrow()):this.cash()?.serverDate||'',name:'',email:'',phone:'',note:'',adults:1,children:0,seniors:0,vehicles:0,locale:this.locale()};}
  }
  private admissionBody():Record<string,unknown>{const g=this.selected();return {name:this.draft.name||null,email:this.draft.email||null,phone:this.draft.phone||null,note:this.draft.note||null,adults:this.draft.adults,children:this.draft.children,seniors:this.draft.seniors,vehicles:this.draft.vehicles,reservationId:this.mode()==='checkin'?g?.id:null,reservationVersion:this.mode()==='checkin'?g?.version:null,rateVersion:this.quote()?.rateVersion};}
  private correctionBody():Record<string,unknown>{return {version:this.selected()?.version,adults:this.draft.adults,children:this.draft.children,seniors:this.draft.seniors,vehicles:this.draft.vehicles,reason:this.reason};}
  async review():Promise<void>{if(this.busy()||this.uncertain())return;this.busy.set(true);this.error.set('');this.fields.set({});try{
    if(this.mode()==='reservation')this.quote.set(await this.api.request<Quote>('/public/reservation-quotes','POST',this.draft));
    else if(this.mode()==='editReservation')this.quote.set(await this.api.request<Quote>(`/reservations/${this.selected()!.id}/quotes`,'POST',{version:this.selected()!.version,request:this.draft}));
    else if(this.mode()==='correction'){const result=await this.api.request<{quote:Quote;difference:string}>(`/admissions/${this.selected()!.id}/correction-quotes`,'POST',this.correctionBody());this.quote.set(result.quote);this.difference.set(result.difference);}
    else this.quote.set(await this.api.request<Quote>('/admissions/quotes','POST',this.admissionBody()));
  }catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async submit():Promise<void>{if(this.busy()||this.uncertain()||!this.quote())return;let path='/admissions';let body:unknown=this.admissionBody();
    if(this.mode()==='reservation'){path='/reservations';body={...this.draft,rateVersion:this.quote()!.rateVersion};}
    else if(this.mode()==='editReservation'){await this.saveSimple(`/reservations/${this.selected()!.id}`,'PATCH',{version:this.selected()!.version,request:this.draft});return;}
    else{if(this.mode()==='correction'){path=`/admissions/${this.selected()!.id}/corrections`;body=this.correctionBody();}body={...(body as object),paymentMethod:this.payable()==='0.00'?null:this.paymentMethod,receivedAmount:this.paymentMethod==='CASH'&&!this.payable().startsWith('-')&&this.payable()!=='0.00'?this.receivedAmount:null,reference:this.payable().startsWith('-')?null:this.reference||null};}
    this.pending.value={path,body,key:crypto.randomUUID(),owner:this.user().id};await this.recover();
  }
  async recover():Promise<void>{const pending=this.pending.value;if(!pending||this.busy())return;if(pending.owner!==this.user().id){this.error.set('OPERATION_OWNER_REQUIRED');return;}this.busy.set(true);this.error.set('');try{const result=await this.api.request<Group&{changeAmount?:string}>(pending.path,'POST',pending.body,{'Idempotency-Key':pending.key});this.pending.value=null;this.uncertain.set(false);this.dirty=false;this.mode.set('');this.quote.set(null);this.success.set('operationSaved');this.selected.set(pending.path==='/reservations'?null:result);this.selectedKind.set(pending.path==='/reservations'?'reservations':'admissions');this.updated.emit();await this.load();this.busy.set(true);if(pending.path==='/reservations'){try{this.selected.set(await this.api.request<Group>(`/reservations/${result.id}`));}catch(e){this.fail(e);}}}catch(e){const uncertain=!(e instanceof ApiFailure)||e.status===0||e.status>=500||e.status===401||e.code==='IDEMPOTENCY_CONFLICT';this.uncertain.set(uncertain);if(!uncertain){this.pending.value=null;if(e instanceof ApiFailure&&e.status===409)this.quote.set(null);}this.fail(e);}finally{this.busy.set(false);}}
  async saveContact():Promise<void>{const g=this.selected()!;await this.saveSimple(`/admissions/${g.id}`,'PATCH',{version:g.version,name:this.draft.name||null,email:this.draft.email||null,phone:this.draft.phone||null,note:this.draft.note||null});}
  async transition():Promise<void>{if(!window.confirm(this.t('confirmStateChange')))return;const action=this.mode()==='noShow'?'no-show':'cancel';await this.saveSimple(`/reservations/${this.selected()!.id}/${action}`,'POST',{version:this.selected()!.version,reason:this.reason});}
  private async saveSimple(path:string,method:string,body:unknown):Promise<void>{this.busy.set(true);this.error.set('');try{await this.api.request(path,method,body);const id=this.selected()!.id;this.selected.set(await this.api.request<Group>(`/${this.selectedKind()}/${id}`));this.mode.set('');this.quote.set(null);this.dirty=false;this.success.set('operationSaved');this.updated.emit();await this.load();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async openCash():Promise<void>{this.busy.set(true);this.error.set('');try{this.cash.set(await this.api.request<Cash>('/cash-sessions','POST',{openingFloat:this.openingFloat}));this.openingDirty=false;this.openingFloat='0.00';this.success.set('cashOpened');}catch(e){this.fail(e);await this.load();}finally{this.busy.set(false);}}
  cancelOpening():void{if(this.openingDirty&&!window.confirm(this.t('discard')))return;this.openingFloat='0.00';this.openingDirty=false;}
  cancel():void{if(!this.canLeave())return;this.mode.set('');this.quote.set(null);this.dirty=false;this.error.set('');this.fields.set({});}
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent):void{if(this.dirty||this.openingDirty||this.uncertain()){event.preventDefault();event.returnValue='';}}
}
