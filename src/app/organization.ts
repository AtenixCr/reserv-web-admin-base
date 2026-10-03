import { Component, HostListener, Injectable, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, ApiFailure } from './api';
import { Identity, Locale } from './models';
import { translations } from './translations';
interface CalendarDay {date:string;reservations:number;tasks:number;pendingTasks:number;}
interface CalendarMonth {month:string;serverDate:string;days:CalendarDay[];}
interface Task {id:string;taskDate:string;title:string;description:string;status:string;version:string;authorName:string;updatedByName:string;updatedAt:string;}
interface Reservation {id:string;name:string;code:string;status:string;adults:number;children:number;seniors:number;}
interface Page<T> {items:T[];page:number;size:number;total:number;}
interface Pending {path:string;method:string;body:unknown;key:string;owner:string;date:string;}
@Injectable({providedIn:'root'}) export class PendingTask {value:Pending|null=null;}
@Component({selector:'app-organization',imports:[FormsModule],templateUrl:'./organization.html',styleUrl:'./organization.css'})
export class Organization implements OnInit {
  private readonly api=inject(Api);readonly pending=inject(PendingTask);readonly user=input.required<Identity>();readonly locale=input<Locale>('es');readonly sessionExpired=output<void>();readonly updated=output<void>();
  readonly busy=signal(false);readonly error=signal('');readonly success=signal('');readonly uncertain=signal(false);readonly calendar=signal<CalendarMonth|null>(null);readonly tasks=signal<Page<Task>>({items:[],page:0,size:20,total:0});readonly reservations=signal<Page<Reservation>>({items:[],page:0,size:20,total:0});readonly editing=signal(false);
  monthDraft='';selected='';dirty=false;taskPage=0;reservationPage=0;draft={id:'',taskDate:'',title:'',description:'',status:'PENDING',version:''};
  t(key:string):string{return translations[this.locale()][key]||key;}
  timestamp(value:string):string{return new Intl.DateTimeFormat(this.locale(),{timeZone:'America/Costa_Rica',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
  monthLabel():string{return this.calendar()?new Intl.DateTimeFormat(this.locale(),{timeZone:'UTC',month:'long',year:'numeric'}).format(new Date(this.calendar()!.month+'-01T12:00:00Z')):'';}
  weekdays():string[]{return [1,2,3,4,5,6,7].map(n=>new Intl.DateTimeFormat(this.locale(),{timeZone:'UTC',weekday:'short'}).format(new Date(Date.UTC(2024,0,n))));}
  cells():(CalendarDay|null)[]{const month=this.calendar();if(!month)return [];const offset=(new Date(month.month+'-01T12:00:00Z').getUTCDay()+6)%7;return [...Array(offset).fill(null),...month.days];}
  canLeave():boolean{return !this.busy()&&!this.uncertain()&&(!this.dirty||window.confirm(this.t('discard')));}
  fail(e:unknown):void{this.error.set(e instanceof ApiFailure?e.code:'UNEXPECTED_ERROR');if(e instanceof ApiFailure&&e.status===401){this.api.reset();this.sessionExpired.emit();}queueMicrotask(()=>document.getElementById('organization-feedback')?.focus());}
  async ngOnInit():Promise<void>{this.uncertain.set(!!this.pending.value);if(this.pending.value)this.error.set('UNCERTAIN_OPERATION');await this.load();}
  async load(month?:string):Promise<void>{this.busy.set(true);try{const c=await this.api.request<CalendarMonth>('/calendar'+(month?'?month='+month:''));this.calendar.set(c);this.monthDraft=c.month;if(!this.selected.startsWith(c.month))this.selected=c.serverDate.startsWith(c.month)?c.serverDate:c.month+'-01';await this.loadDay();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async loadDay():Promise<void>{const [tasks,reservations]=await Promise.all([this.api.request<Page<Task>>(`/tasks?date=${this.selected}&page=${this.taskPage}`),this.api.request<Page<Reservation>>(`/reservations?date=${this.selected}&page=${this.reservationPage}`)]);this.tasks.set(tasks);this.reservations.set(reservations);}
  reset():void{this.dirty=false;this.editing.set(false);this.error.set('');this.success.set('');}
  async navigateMonth(month:string):Promise<void>{if(!this.canLeave())return;this.reset();this.taskPage=0;this.reservationPage=0;await this.load(month);}
  async shift(delta:number):Promise<void>{const [year,month]=this.calendar()!.month.split('-').map(Number);const total=year*12+month-1+delta;const nextYear=Math.floor(total/12);if(nextYear<1||nextYear>9999)return;await this.navigateMonth(`${String(nextYear).padStart(4,'0')}-${String(total%12+1).padStart(2,'0')}`);}
  async today():Promise<void>{if(!this.canLeave())return;this.reset();this.selected='';this.taskPage=0;this.reservationPage=0;await this.load();}
  cancelMonth():void{this.monthDraft=this.calendar()?.month||'';}
  async selectDay(date:string):Promise<void>{if(!this.canLeave())return;this.reset();this.selected=date;this.taskPage=0;this.reservationPage=0;this.busy.set(true);try{await this.loadDay();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async paginate(kind:string,delta:number):Promise<void>{if(!this.canLeave())return;this.reset();if(kind==='tasks')this.taskPage+=delta;else this.reservationPage+=delta;this.busy.set(true);try{await this.loadDay();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  edit(task?:Task):void{if(!this.canLeave())return;this.reset();this.draft=task?{id:task.id,taskDate:task.taskDate,title:task.title,description:task.description,status:task.status,version:task.version}:{id:'',taskDate:this.selected,title:'',description:'',status:'PENDING',version:''};this.editing.set(true);}
  cancel():void{if(this.canLeave())this.reset();}
  async save():Promise<void>{if(this.busy()||this.uncertain())return;const {id,...body}=this.draft;this.pending.value={path:'/tasks'+(id?'/'+id:''),method:id?'PATCH':'POST',body,key:crypto.randomUUID(),owner:this.user().id,date:body.taskDate};await this.recover();}
  async remove(task:Task):Promise<void>{if(!this.canLeave()||!window.confirm(this.t('deleteTaskConfirm')))return;this.pending.value={path:'/tasks/'+task.id,method:'DELETE',body:{version:task.version},key:crypto.randomUUID(),owner:this.user().id,date:task.taskDate};await this.recover();}
  async recover():Promise<void>{const pending=this.pending.value;if(!pending||this.busy())return;if(pending.owner!==this.user().id){this.error.set('OPERATION_OWNER_REQUIRED');return;}this.busy.set(true);this.error.set('');try{await this.api.request(pending.path,pending.method,pending.body,{'Idempotency-Key':pending.key});this.pending.value=null;this.uncertain.set(false);this.reset();this.selected=pending.date;this.taskPage=0;this.reservationPage=0;this.success.set('taskSaved');this.updated.emit();await this.load(pending.date.slice(0,7));}catch(e){const uncertain=!(e instanceof ApiFailure)||e.status===0||e.status>=500||e.status===401||e.code==='IDEMPOTENCY_CONFLICT';this.uncertain.set(uncertain);if(!uncertain)this.pending.value=null;this.fail(e);}finally{this.busy.set(false);}}
  async reloadTask():Promise<void>{if(!this.draft.id||!this.canLeave())return;this.busy.set(true);try{const task=await this.api.request<Task>('/tasks/'+this.draft.id);this.draft={id:task.id,taskDate:task.taskDate,title:task.title,description:task.description,status:task.status,version:task.version};this.dirty=false;this.error.set('');}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent):void{if(this.dirty||this.uncertain()){event.preventDefault();event.returnValue='';}}
}
