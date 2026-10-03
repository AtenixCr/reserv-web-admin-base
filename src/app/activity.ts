import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiFailure } from './api';
import { Locale } from './models';
import { translations } from './translations';
interface Group {groupKey:string;occurredAt:string;actorName:string|null;entryCount:number;type:string;}
interface Entry {id:string;occurredAt:string;actorName:string|null;entity:string|null;entityId:string|null;type:string;outcome:string;origin:string;source:string;}
interface Page<T>{items:T[];page:number;size:number;total:number;}
@Component({selector:'app-activity',imports:[FormsModule],templateUrl:'./activity.html',styleUrl:'./organization.css'})
export class Activity implements OnInit {
  private readonly api=inject(Api);readonly locale=input<Locale>('es');readonly sessionExpired=output<void>();readonly busy=signal(false);readonly error=signal('');readonly groups=signal<Page<Group>>({items:[],page:0,size:20,total:0});readonly detail=signal<Page<Entry>|null>(null);readonly options=signal<{actors:{id:string;name:string}[];types:string[];entities:string[]}>({actors:[],types:[],entities:[]});
  from='';to='';actorId='';type='';entity='';serverDate='';page=0;entryPage=0;selected='';applied='';
  t(key:string):string{return translations[this.locale()][key]||key;}
  typeLabel(type:string):string{return translations[this.locale()]['event.'+type]||this.t('activityRecord');}
  entityLabel(entity:string|null):string{return entity?(translations[this.locale()]['entity.'+entity]||entity):this.t('application');}
  timestamp(value:string):string{return new Intl.DateTimeFormat(this.locale(),{timeZone:'America/Costa_Rica',dateStyle:'medium',timeStyle:'medium'}).format(new Date(value));}
  icon(type:string):string{return type==='DELETE'?'−':type==='INSERT'?'+':type==='LOGIN'||type==='LOGOUT'?'↪':type==='EMAIL_RESULT'?'✉':type==='REPORT_EXPORTED'?'↓':'◷';}
  fail(e:unknown):void{this.error.set(e instanceof ApiFailure?e.code:'UNEXPECTED_ERROR');if(e instanceof ApiFailure&&e.status===401){this.api.reset();this.sessionExpired.emit();}}
  async ngOnInit():Promise<void>{this.busy.set(true);try{const [calendar,options]=await Promise.all([this.api.request<{serverDate:string}>('/calendar'),this.api.request<{actors:{id:string;name:string}[];types:string[];entities:string[]}>('/activity/options')]);this.serverDate=calendar.serverDate;this.from=calendar.serverDate.slice(0,7)+'-01';this.to=calendar.serverDate;this.options.set(options);}catch(e){this.fail(e);}finally{this.busy.set(false);}if(this.serverDate)await this.search();}
  async search():Promise<void>{if(this.busy())return;this.page=0;this.selected='';this.detail.set(null);this.applied=new URLSearchParams({from:this.from,to:this.to, ...(this.actorId?{actorId:this.actorId}:{}),type:this.type,entity:this.entity}).toString();await this.load();}
  async load():Promise<void>{this.busy.set(true);this.error.set('');try{this.groups.set(await this.api.request<Page<Group>>('/activity?'+this.applied+'&page='+this.page));}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async cancel():Promise<void>{if(this.busy())return;this.from=this.serverDate.slice(0,7)+'-01';this.to=this.serverDate;this.actorId='';this.type='';this.entity='';await this.search();}
  async paginate(delta:number):Promise<void>{if(this.busy())return;this.page+=delta;this.selected='';this.detail.set(null);await this.load();}
  async open(group:string):Promise<void>{if(this.busy())return;this.selected=group;this.entryPage=0;await this.loadEntries();}
  async loadEntries():Promise<void>{this.busy.set(true);this.error.set('');try{this.detail.set(await this.api.request<Page<Entry>>('/activity/'+encodeURIComponent(this.selected)+'/entries?page='+this.entryPage));}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async paginateEntries(delta:number):Promise<void>{if(this.busy())return;this.entryPage+=delta;await this.loadEntries();}
}
