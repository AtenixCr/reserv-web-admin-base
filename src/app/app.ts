import { Component, OnInit, computed, inject, signal, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiFailure } from './api';
import { Dashboard, Identity, Locale, PublicBusiness, Settings, Snapshot } from './models';
import { Organization } from './organization';
import { Activity } from './activity';
import { Finance } from './finance';
import { Operations } from './operations';
import { translations } from './translations';
@Component({selector:'app-root',imports:[FormsModule,Operations,Finance,Organization,Activity],templateUrl:'./app.html',styleUrl:'./app.css'})
export class App implements OnInit {
  private readonly api = inject(Api);
  @ViewChild(Operations) operations?:Operations;
  @ViewChild(Organization) organization?:Organization;
  @ViewChild(Finance) finance?:Finance;
  operationsExpired():void {this.user.set(null);this.message.set('SESSION_EXPIRED');}
  async operationsUpdated():Promise<void> {try{this.dashboard.set(await this.api.request<Dashboard>('/dashboard'));}catch(e){this.fail(e);}}
  readonly locale = signal<Locale>(this.readLocale());
  readonly user = signal<Identity|null>(null);
  readonly busy = signal(false);
  readonly page = signal('home');
  readonly section = signal('business');
  readonly dashboard = signal<Dashboard|null>(null);
  readonly publicBusiness = signal<PublicBusiness|null>(null);
  readonly snapshot = signal<Snapshot|null>(null);
  readonly message = signal('');
  readonly fields = signal<Record<string,string>>({});
  readonly success = signal(false);
  readonly fieldLabels = computed(() => Object.keys(this.fields()).filter(key => key!=='dates'&&key!=='retryAfter').map(key => this.t(({rates:'conversion',capacityOverrides:'overrides',translations:'business'} as Record<string,string>)[key] || key.split('.').pop()!.replace(/\[[0-9]+\]/g,''))));
  readonly businessName = computed(() => {
    const list = this.publicBusiness()?.translations || [];
    return (list.find(t=>t.locale === this.locale()) || list.find(t=>t.locale === 'es'))?.displayName || this.t('brand');
  });
  username = ''; password = ''; dirty = false;
  draft: Settings = this.emptySettings();
  priceDraft = {adultPrice:'0.00',childPrice:'0.00',seniorPrice:'0.00',parkingPrice:'0.00'};
  exchangeDraft = [{currency:'USD' as const,rate:'',updatedOn:'',active:false},{currency:'BRL' as const,rate:'',updatedOn:'',active:false}];
  readonly priceFields = ['adultPrice','childPrice','seniorPrice','parkingPrice'] as const;
  readonly priceLabels = ['adults','children','seniors','vehicles'];
  readonly languages: Locale[] = ['es','en','pt'];
  readonly weekdays = [1,2,3,4,5,6,7];
  async ngOnInit(): Promise<void> {
    this.setLocale(this.locale());
    try { this.user.set(await this.api.request<Identity>('/auth/me')); await this.load(); }
    catch(error) { if (!(error instanceof ApiFailure && error.status === 401)) this.fail(error); }
  }
  t(key:string):string { return translations[this.locale()][key] || key; }
  private readLocale():Locale { try { const value=window.localStorage.getItem('locale'); return value==='en'||value==='pt'?value:'es'; } catch {return 'es';} }
  setLocale(value:string):void { if(value!=='es'&&value!=='en'&&value!=='pt')return; this.locale.set(value); document.documentElement.lang=value; document.title=this.t('brand'); try{window.localStorage.setItem('locale',value);}catch{} }
  dayName(day:number):string { return new Intl.DateTimeFormat(this.locale(),{weekday:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2024,0,day))); }
  private emptySettings():Settings { return {version:'new',defaultCapacity:0,phone:'',email:'',address:'',sinpeNumber:'',enabled:false,translations:[{locale:'es',displayName:'',description:'',services:''}],hours:[],closedDates:[],capacityOverrides:[]}; }
  private fail(error:unknown):void { this.success.set(false); this.message.set(error instanceof ApiFailure ? error.code : 'UNEXPECTED_ERROR'); this.fields.set(error instanceof ApiFailure ? error.fields : {}); if(error instanceof ApiFailure && (error.code==='SESSION_EXPIRED'||error.code==='AUTHENTICATION_REQUIRED'))this.user.set(null); }
  dismiss():void {this.message.set('');this.fields.set({});}
  async login():Promise<void> { this.busy.set(true);this.dismiss();try {this.user.set(await this.api.request<Identity>('/auth/login','POST',{username:this.username,password:this.password}));this.password='';this.api.reset();await this.load();}catch(e){this.fail(e);}finally{this.busy.set(false);} }
  cancelLogin():void {if((this.username||this.password)&&!window.confirm(this.t('discard')))return;this.username='';this.password='';this.dismiss();}
  async logout():Promise<void> {if(!this.discard())return;this.busy.set(true);try{await this.api.request('/auth/logout','POST',{});this.user.set(null);this.api.reset();this.username='';this.password='';this.snapshot.set(null);this.page.set('home');this.dismiss();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async load():Promise<void> { this.dashboard.set(await this.api.request<Dashboard>('/dashboard'));this.publicBusiness.set(await this.api.request<PublicBusiness>('/public/business'));if(this.user()?.role==='ADMIN'){this.snapshot.set(await this.api.request<Snapshot>('/settings'));if(!this.dirty)this.resetDrafts();} }
  private resetDrafts():void {
    const current=this.snapshot();this.draft=structuredClone(current?.settings||this.emptySettings());
    for(const locale of this.languages)if(!this.draft.translations.some(t=>t.locale===locale))this.draft.translations.push({locale,displayName:'',description:'',services:''});
    const rate=current?.ratePlan;for(const field of this.priceFields)this.priceDraft[field]=rate?.[field]||'0.00';
    for(const value of this.exchangeDraft){const saved=current?.exchangeRates.find(r=>r.currency===value.currency);value.active=!!saved;value.rate=saved?.rate||'';value.updatedOn=saved?.updatedOn||current?.serverDate||'';}
    this.dirty=false;
  }
  private discard():boolean {if(this.organization&&!this.organization.canLeave())return false;if(this.finance&&!this.finance.canLeave())return false;if(this.operations&&!this.operations.canLeave())return false;if(this.dirty&&!window.confirm(this.t('discard')))return false;this.resetDrafts();return true;}
  navigate(page:string):void {if(this.busy()||!this.discard())return;this.page.set(page);this.dismiss();}
  tab(section:string):void {if(this.busy()||!this.discard())return;this.section.set(section);this.dismiss();}
  cancel():void {if(this.discard())this.dismiss();}
  async reload():Promise<void> {if(this.dirty&&!window.confirm(this.t('reloadConfirm')))return;this.dirty=false;this.busy.set(true);try{await this.load();this.dismiss();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async save(kind:string):Promise<void> {
    this.busy.set(true);this.dismiss();
    try { const version=this.snapshot()?.settings?.version||'new';let result:Snapshot;
      if(kind==='business'){const value=structuredClone(this.draft);value.translations=value.translations.filter(t=>t.locale==='es'||!!t.displayName.trim());result=await this.api.request<Snapshot>('/settings','PUT',value);}
      else if(kind==='prices')result=await this.api.request<Snapshot>('/rate-plans','POST',{version,...this.priceDraft});
      else result=await this.api.request<Snapshot>('/exchange-rates','PUT',{version,rates:this.exchangeDraft.filter(r=>r.active).map(({currency,rate,updatedOn})=>({currency,rate,updatedOn}))});
      this.snapshot.set(result);this.resetDrafts();this.success.set(true);this.message.set('success');
    }catch(e){this.fail(e);}finally{this.busy.set(false);}
  }
  addHour():void {this.draft.hours.push({weekday:1,opensAt:'08:00',closesAt:'17:00'});this.dirty=true;}
  addClosed():void {this.draft.closedDates.push({visitDate:this.snapshot()?.serverDate||'',reason:''});this.dirty=true;}
  addOverride():void {this.draft.capacityOverrides.push({visitDate:this.snapshot()?.serverDate||'',capacity:this.draft.defaultCapacity});this.dirty=true;}
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent):void {if(this.dirty){event.preventDefault();event.returnValue='';}}
}
