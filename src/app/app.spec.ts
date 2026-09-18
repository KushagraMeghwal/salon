import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { App } from './app';

describe('App', () => {
  it('creates the root component', () => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideTranslateService({ lang: 'en', fallbackLang: 'en' })] });
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
