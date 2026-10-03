import { TestBed } from '@angular/core/testing';
import { Api, ApiFailure } from './api';
import { Operations, PendingOperation, Group, Quote } from './operations';
import { translations } from './translations';
describe('Admissions and payments',()=>{
  let request:ReturnType<typeof vi.fn>;
  const quote:Quote={visitDate:'2026-09-25',rateVersion:'1',currency:'CRC',total:'17000.00',hours:[],lines:[{category:'adults',quantity:2,unitPrice:'5000.00',subtotal:'10000.00'},{category:'children',quantity:1,unitPrice:'2500.00',subtotal:'2500.00'},{category:'seniors',quantity:1,unitPrice:'3500.00',subtotal:'3500.00'},{category:'vehicles',quantity:1,unitPrice:'1000.00',subtotal:'1000.00'}]};
  const group:Group={id:'7',code:'VIS-TEST',visitDate:'2026-09-25',version:'v1',status:'ADMITTED',name:null,email:null,phone:null,note:null,adults:2,children:1,seniors:1,vehicles:1,quote};
  beforeEach(()=>{request=vi.fn().mockImplementation((path:string)=>Promise.resolve(path==='/cash-sessions/current'?{serverDate:'2026-09-25',session:{id:'1',businessDate:'2026-09-25',status:'OPEN',canPay:true}}:{items:[],page:0,size:20,total:0}));TestBed.configureTestingModule({providers:[{provide:Api,useValue:{request,reset:vi.fn()}}]});});
  afterEach(()=>vi.restoreAllMocks());
  it.each(['es','en','pt'])('distinguishes a closed day from an older open session in %s',async(locale)=>{
    const fixture=await component('ADMIN');const c=fixture.componentInstance;fixture.componentRef.setInput('locale',locale);
    c.cash.set({serverDate:'2026-09-25',session:{id:'1',businessDate:'2026-09-25',status:'CLOSED',canPay:false}});fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(translations[locale]['cashClosedToday']);
    expect(fixture.nativeElement.textContent).not.toContain(translations[locale]['cashUnavailable']);
    const buttons=Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons.find(b=>b.textContent?.includes(translations[locale]['newWalkIn']))?.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#filter-date')).not.toBeNull();
    c.cash.set({serverDate:'2026-09-25',session:{id:'1',businessDate:'2026-09-24',status:'OPEN',canPay:false}});fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(translations[locale]['cashUnavailable']);
    expect(fixture.nativeElement.textContent).not.toContain(translations[locale]['cashClosedToday']);
  });
  async function component(role='STAFF'){const fixture=TestBed.createComponent(Operations);fixture.componentRef.setInput('user',{id:'1',name:'Test',username:'test',role});await fixture.whenStable();return fixture;}
  it('keeps money exact and hides quantity corrections from STAFF',async()=>{const fixture=await component();const c=fixture.componentInstance;c.selected.set(group);c.selectedKind.set('admissions');fixture.detectChanges();expect(fixture.nativeElement.textContent).toContain('Editar contacto y nota');expect(fixture.nativeElement.textContent).not.toContain('Corregir cantidades');c.mode.set('walkin');c.quote.set({...quote,total:'9007199254740992.01'});c.receivedAmount='9007199254740993.02';expect(c.change()).toBe('1.01');expect(c.money('-2500.00')).toContain('2');});
  it('freezes an uncertain payment and retries the identical key and body',async()=>{const fixture=await component();const c=fixture.componentInstance;c.start('walkin');c.quote.set(quote);c.receivedAmount='20000';const defaults=request.getMockImplementation()! as (...args:unknown[])=>unknown;let attempts=0;request.mockImplementation((path:string,...args:unknown[])=>path==='/admissions'?(++attempts===1?Promise.reject(new ApiFailure('NETWORK_ERROR',{},0)):Promise.resolve(group)):defaults(path,...args));await c.submit();expect(c.uncertain()).toBe(true);expect(c.canLeave()).toBe(false);const pending=TestBed.inject(PendingOperation).value;expect(pending?.body).toHaveProperty('receivedAmount','20000');await c.recover();const calls=request.mock.calls.filter(call=>call[0]==='/admissions');expect(calls).toHaveLength(2);expect(calls[0]).toEqual(calls[1]);expect(c.selected()?.code).toBe('VIS-TEST');expect(c.uncertain()).toBe(false);expect(TestBed.inject(PendingOperation).value).toBeNull();});
  it('preserves a rejected form and requires confirmation before discarding',async()=>{const fixture=await component();const c=fixture.componentInstance;c.start('walkin');c.draft.name='Visitor';c.dirty=true;c.quote.set(quote);request.mockRejectedValue(new ApiFailure('INSUFFICIENT_CASH',{receivedAmount:'INVALID_FIELD'},400));await c.submit();expect(c.draft.name).toBe('Visitor');expect(c.quote()).toEqual(quote);expect(c.uncertain()).toBe(false);const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);c.cancel();expect(c.mode()).toBe('walkin');confirm.mockReturnValue(true);c.cancel();expect(c.mode()).toBe('');});
  it('keeps a pending operation across session expiry and requires the original operator',async()=>{const fixture=await component();const c=fixture.componentInstance;c.start('walkin');c.quote.set(quote);request.mockRejectedValue(new ApiFailure('SESSION_EXPIRED',{},401));await c.submit();expect(TestBed.inject(PendingOperation).value).not.toBeNull();const calls=request.mock.calls.length;fixture.componentRef.setInput('user',{id:'2',role:'ADMIN',name:'Other',username:'other'});await c.recover();expect(request.mock.calls).toHaveLength(calls);expect(c.error()).toBe('OPERATION_OWNER_REQUIRED');});
  it('has matching language keys and the specified age boundaries',()=>{expect(Object.keys(translations['en']).sort()).toEqual(Object.keys(translations['es']).sort());expect(Object.keys(translations['pt']).sort()).toEqual(Object.keys(translations['es']).sort());for(const lang of ['es','en','pt']){expect(translations[lang]['ageRanges']).toContain('0–10');expect(translations[lang]['ageRanges']).toContain('11–64');}});
  it.each(['walkin','reservation','editReservation','contact','correction','cancelReservation','noShow','checkin'])('cancels the rendered %s form without submitting data',async(mode)=>{
    const fixture=await component('ADMIN');const c=fixture.componentInstance;
    c.selected.set({...group,status:'CONFIRMED'});c.selectedKind.set('reservations');c.start(mode);
    fixture.changeDetectorRef.markForCheck();await fixture.whenStable();fixture.detectChanges();
    const form=fixture.nativeElement.querySelector('.editor form') as HTMLFormElement;
    expect(form).not.toBeNull();
    const input=form.querySelector('textarea:not(:disabled),input:not(:disabled)') as HTMLInputElement;
    if(input){input.value=input.type==='number'?'3':'Local cancellation test';input.dispatchEvent(new Event('input',{bubbles:true}));await fixture.whenStable();}
    else {c.dirty=true;}
    const before=JSON.stringify(c.draft);const calls=request.mock.calls.length;
    const cancel=Array.from(form.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Cancelar')!;
    expect(cancel).toBeDefined();expect(cancel.type).toBe('button');
    const confirmation=vi.spyOn(window,'confirm').mockReturnValue(false);
    cancel.click();await fixture.whenStable();expect(c.mode()).toBe(mode);expect(JSON.stringify(c.draft)).toBe(before);
    confirmation.mockReturnValue(true);cancel.click();await fixture.whenStable();expect(c.mode()).toBe('');
    expect(request.mock.calls.length).toBe(calls);
  });
});
