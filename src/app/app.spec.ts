import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Api, ApiFailure } from './api';

describe('Staff access', () => {
  let request: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    window.localStorage.clear();
    request=vi.fn().mockRejectedValue(new ApiFailure('AUTHENTICATION_REQUIRED',{},401));
    TestBed.configureTestingModule({providers:[{provide:Api,useValue:{request,reset:vi.fn()}}]});
  });
  afterEach(() => vi.restoreAllMocks());
  it('preserves credentials on errors and supports confirmed cancellation', async () => {
    const fixture=TestBed.createComponent(App); await fixture.whenStable();
    fixture.componentInstance.username='staff.local';fixture.componentInstance.password='invalid';
    request.mockRejectedValue(new ApiFailure('INVALID_CREDENTIALS',{},401));
    await fixture.componentInstance.login();
    expect(fixture.componentInstance.username).toBe('staff.local');
    expect(fixture.componentInstance.message()).toBe('INVALID_CREDENTIALS');
    const confirmation=vi.spyOn(window,'confirm').mockReturnValue(false);
    fixture.componentInstance.cancelLogin();expect(fixture.componentInstance.password).toBe('invalid');
    confirmation.mockReturnValue(true);fixture.componentInstance.cancelLogin();
    expect(fixture.componentInstance.password).toBe('');expect(fixture.componentInstance.username).toBe('');
  });
  it('shows staff identity while hiding configuration', async () => {
    request.mockImplementation((path:string) => Promise.resolve(path==='/auth/me'?{id:'1',username:'staff',name:'Demo Staff',role:'STAFF'}:path==='/dashboard'?{serverDate:'2026-09-25',pendingReservations:2,admittedPeople:3,tasks:[],hours:[]}:{translations:[],exchangeRates:[]}));
    const fixture=TestBed.createComponent(App); await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Demo Staff');
    expect(fixture.nativeElement.querySelector('nav').textContent).not.toContain('Configuración');
  });
  it('persists locale and leaves unsaved settings intact after a conflict', async () => {
    const fixture=TestBed.createComponent(App);await fixture.whenStable();
    fixture.componentInstance.setLocale('pt');
    fixture.componentInstance.draft.phone='12345678';fixture.componentInstance.dirty=true;
    request.mockRejectedValue(new ApiFailure('VERSION_CONFLICT',{},409));
    await fixture.componentInstance.save('business');
    expect(window.localStorage.getItem('locale')).toBe('pt');
    expect(fixture.componentInstance.draft.phone).toBe('12345678');
    expect(fixture.componentInstance.dirty).toBe(true);
  });
  it.each(['business','prices','conversion'])('restores %s settings only after confirmed cancellation',async(section)=>{
    const fixture=TestBed.createComponent(App);await fixture.whenStable();const c=fixture.componentInstance;
    c.user.set({id:'1',username:'admin',name:'Admin',role:'ADMIN'});c.navigate('settings');c.tab(section);
    fixture.changeDetectorRef.markForCheck();await fixture.whenStable();fixture.detectChanges();
    const form=fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const input=form.querySelector('input') as HTMLInputElement;const initial=input.value;const checked=input.checked;
    if(input.type==='checkbox'){input.checked=!checked;input.dispatchEvent(new Event('change',{bubbles:true}));}
    else{input.value='12345';input.dispatchEvent(new Event('input',{bubbles:true}));}
    await fixture.whenStable();expect(c.dirty).toBe(true);const calls=request.mock.calls.length;
    const cancel=Array.from(form.querySelectorAll('button')).find(b=>b.textContent?.trim()==='Cancelar')!;
    expect(cancel.type).toBe('button');const confirmation=vi.spyOn(window,'confirm').mockReturnValue(false);
    cancel.click();await fixture.whenStable();expect(c.dirty).toBe(true);
    confirmation.mockReturnValue(true);cancel.click();await fixture.whenStable();expect(c.dirty).toBe(false);
    expect(input.type==='checkbox'?input.checked:input.value).toBe(input.type==='checkbox'?checked:initial);
    expect(request.mock.calls.length).toBe(calls);
  });
});
