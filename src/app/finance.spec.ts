import { TestBed } from '@angular/core/testing';
import { Api, ApiFailure } from './api';
import { Finance, PendingFinance } from './finance';
describe('Finance',()=>{
  let request:ReturnType<typeof vi.fn>;
  const snapshot={businessDate:'2026-09-25',timezone:'America/Costa_Rica',currency:'CRC',openingFloat:'20000.00',totals:{payments:'90000.00',expenses:'5000.00',refunds:'2000.00',adjustments:'0.00',additionalPayments:'0.00',compensations:'0.00',operatingResult:'83000.00',expectedCash:'63000.00',adults:18,children:0,seniors:0,vehicles:0},methods:[],payments:[],expenses:[],refunds:[],adjustments:[],attendance:[]};
  beforeEach(()=>{request=vi.fn().mockImplementation((path:string)=>Promise.resolve(path==='/cash-sessions/current'?{serverDate:'2026-09-25',session:{id:'1',businessDate:'2026-09-25',canPay:true,status:'OPEN'}}:{serverDate:'2026-09-25',session:{id:'1',businessDate:'2026-09-25',status:'OPEN',version:'v1'},snapshot,closureId:null}));TestBed.configureTestingModule({providers:[{provide:Api,useValue:{request,reset:vi.fn(),download:vi.fn()}}]});});
  afterEach(()=>vi.restoreAllMocks());
  async function component(){const fixture=TestBed.createComponent(Finance);fixture.componentRef.setInput('user',{id:'1',role:'ADMIN',name:'Admin',username:'admin'});await fixture.whenStable();return fixture;}
  it('shows reconciliation and requires a note when counted cash differs',async()=>{const fixture=await component();const c=fixture.componentInstance;c.start('close');fixture.changeDetectorRef.markForCheck();fixture.detectChanges();await fixture.whenStable();const input=fixture.nativeElement.querySelector('#counted-cash') as HTMLInputElement;input.value='62500';input.dispatchEvent(new Event('input'));await fixture.whenStable();expect(c.difference()).toBe('-500.00');expect(fixture.nativeElement.querySelector('#closure-note').required).toBe(true);expect(fixture.nativeElement.textContent).toContain('83.000,00');input.value='63000';input.dispatchEvent(new Event('input'));await fixture.whenStable();expect(c.difference()).toBe('0.00');expect(fixture.nativeElement.querySelector('#closure-note').required).toBe(false);});
  it('retries an uncertain closure with identical key, version and body',async()=>{const fixture=await component();const c=fixture.componentInstance;c.start('close');c.countedCash='63000';await c.prepare();const original=request.getMockImplementation()! as (...args:unknown[])=>unknown;let calls=0;request.mockImplementation((path:string,...args:unknown[])=>path.endsWith('/close')?(++calls===1?Promise.reject(new ApiFailure('NETWORK_ERROR',{},0)):Promise.resolve({id:'9'})):original(path,...args));await c.submit();expect(c.uncertain()).toBe(true);expect(c.canLeave()).toBe(false);expect(TestBed.inject(PendingFinance).value?.body).toHaveProperty('version','v1');await c.recover();const writes=request.mock.calls.filter(call=>call[0].endsWith('/close'));expect(writes).toHaveLength(2);expect(writes[0]).toEqual(writes[1]);expect(TestBed.inject(PendingFinance).value).toBeNull();});
  it('preserves inputs after a conflict and supports refusing cancellation',async()=>{const fixture=await component();const c=fixture.componentInstance;c.start('expense');c.amount='5000';c.category='Supplies';c.description='Local test';c.dirty=true;await c.prepare();request.mockRejectedValue(new ApiFailure('CASH_SESSION_REQUIRED',{},409));await c.submit();expect(c.amount).toBe('5000');expect(c.category).toBe('Supplies');expect(c.review()).toBe(false);vi.spyOn(window,'confirm').mockReturnValue(false);c.cancel();expect(c.mode()).toBe('expense');});
  it.each(['expense','refund','compensation','close'])('cancels the rendered %s form without a financial write',async(mode)=>{
    const fixture=await component();const c=fixture.componentInstance;c.start(mode);
    fixture.changeDetectorRef.markForCheck();await fixture.whenStable();fixture.detectChanges();
    const input=fixture.nativeElement.querySelector(mode==='close'?'#closure-note':mode==='expense'?'#expense-description':'#finance-reason') as HTMLTextAreaElement;
    input.value='Local cancellation test';input.dispatchEvent(new Event('input',{bubbles:true}));await fixture.whenStable();
    const form=input.closest('form')!;const cancel=Array.from(form.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Cancelar')!;
    expect(cancel.type).toBe('button');const calls=request.mock.calls.length;
    const confirmation=vi.spyOn(window,'confirm').mockReturnValue(false);cancel.click();await fixture.whenStable();
    expect(c.mode()).toBe(mode);expect(input.value).toBe('Local cancellation test');
    confirmation.mockReturnValue(true);cancel.click();await fixture.whenStable();expect(c.mode()).toBe('');expect(request.mock.calls.length).toBe(calls);
  });
});
