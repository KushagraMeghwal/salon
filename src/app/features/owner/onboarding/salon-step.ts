import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SalonProfile } from '../../../core/models';
import { SalonStore } from '../../../core/services/salon.store';
import { ToastService } from '../../../core/services/toast.service';
import { SalonMark } from '../../../shared/layout/salon-mark';
import { WizardHeader } from '../../../shared/layout/wizard-header';

const STATES = [
  ['KA', 'Karnataka'], ['MH', 'Maharashtra'], ['DL', 'Delhi NCR'], ['TN', 'Tamil Nadu'], ['TS', 'Telangana'],
  ['GJ', 'Gujarat'], ['RJ', 'Rajasthan'], ['UP', 'Uttar Pradesh'], ['WB', 'West Bengal'], ['KL', 'Kerala'],
];
const CATEGORIES: { value: SalonProfile['category']; icon: string; preview: string }[] = [
  { value: 'Unisex', icon: 'wc', preview: 'Unisex Salon & Spa' },
  { value: "Men's Salon", icon: 'face', preview: "Men's Salon" },
  { value: 'Hair Studio', icon: 'content_cut', preview: 'Hair Studio' },
  { value: 'Luxury Spa', icon: 'spa', preview: 'Luxury Spa' },
];
const INPUT =
  'w-full px-3.5 py-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface text-body-md font-body-md focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none';

@Component({
  selector: 'app-salon-step',
  imports: [FormsModule, WizardHeader, SalonMark],
  template: `
    <div class="min-h-screen flex flex-col bg-background text-on-surface antialiased selection:bg-primary-fixed selection:text-on-primary-fixed">
      <app-wizard-header [active]="1" />

      <main class="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div class="lg:col-span-8 space-y-6">
            <div class="bg-surface-container-lowest rounded-2xl p-6 md:p-8 shadow-level-1 border border-outline-variant/20 relative overflow-hidden">
              <div class="absolute top-0 left-0 h-1.5 bg-primary w-full opacity-90"></div>
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container text-primary font-label-sm text-label-sm mb-3">
                    <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                    Step 1: Establishment Setup
                  </div>
                  <h1 class="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-on-surface font-bold">Tell us about your salon</h1>
                  <p class="font-body-md text-body-md text-tertiary mt-1">Set up your salon profile and storefront details visible to clients.</p>
                </div>
                <span class="hidden sm:inline-flex items-center gap-1 text-label-sm font-label-sm text-tertiary bg-surface-container-low px-2.5 py-1 rounded-md shrink-0">
                  <span class="material-symbols-outlined text-sm text-primary">shield</span>
                  {{ savedLabel() }}
                </span>
              </div>
              <hr class="my-6 border-outline-variant/20" />

              <form class="space-y-6" (submit)="$event.preventDefault()" novalidate>
                <div>
                  <label class="block text-label-lg font-label-lg text-on-surface mb-1.5" for="salon-name">Salon Name <span class="text-secondary">*</span></label>
                  <div class="relative">
                    <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-tertiary"><span class="material-symbols-outlined text-lg">store</span></span>
                    <input id="salon-name" type="text" name="name" placeholder="e.g., Luxe Grooming Studio & Spa" [ngModel]="p().name" (ngModelChange)="patch({ name: $event })" (blur)="touched.set(true)"
                      class="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-surface-container-lowest text-on-surface text-body-md font-body-md focus:ring-2 focus:outline-none transition-all placeholder:text-outline/60"
                      [class]="nameOk() || !touched() ? 'border-outline-variant/40 focus:border-primary focus:ring-primary/20' : 'border-error focus:border-error focus:ring-error/20'" />
                  </div>
                  <p class="text-body-sm font-body-sm mt-1" [class]="nameOk() || !touched() ? 'text-tertiary' : 'text-error'">
                    {{ nameOk() || !touched() ? 'This is the customer-facing name displayed in search and booking receipts.' : 'Enter your salon name (at least 2 characters).' }}
                  </p>
                </div>

                <div>
                  <label class="block text-label-lg font-label-lg text-on-surface mb-1.5">Salon Brand Logo <span class="text-outline font-normal">(optional)</span></label>
                  <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                    <label
                      class="md:col-span-8 border-2 border-dashed rounded-xl p-5 hover:bg-surface-container-low/80 hover:border-primary transition-colors flex flex-col items-center justify-center text-center cursor-pointer group"
                      [class]="dragging() ? 'border-primary bg-primary/5' : 'border-outline-variant/60 bg-surface-container-low/40'"
                      (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)"
                    >
                      <input type="file" class="sr-only" accept="image/png,image/jpeg" (change)="onFile($any($event.target).files?.[0])" />
                      <div class="w-10 h-10 rounded-full bg-surface-container-lowest flex items-center justify-center text-primary group-hover:scale-110 transition-transform shadow-sm mb-2">
                        <span class="material-symbols-outlined text-2xl">cloud_upload</span>
                      </div>
                      <p class="text-label-md font-label-md text-on-surface">Upload salon logo (PNG, JPG up to 5MB)</p>
                      <p class="text-body-sm font-body-sm text-tertiary mt-0.5">Drag and drop here, or <span class="text-primary font-semibold underline">browse file</span></p>
                    </label>
                    <div class="md:col-span-4 flex items-center gap-3 p-3 bg-surface-container rounded-xl border border-outline-variant/30">
                      <div class="relative w-14 h-14 rounded-lg bg-surface-container-lowest flex items-center justify-center overflow-hidden border border-outline-variant/30 p-1 shrink-0">
                        @if (p().logo) {
                          <img alt="Logo Preview" class="w-full h-full object-contain" [src]="p().logo" />
                        } @else {
                          <app-salon-mark size="md" />
                        }
                      </div>
                      <div class="flex-1 min-w-0">
                        @if (p().logo) {
                          <p class="text-label-md font-label-md text-on-surface truncate">{{ logoName() }}</p>
                          <p class="text-body-sm font-body-sm text-tertiary">{{ logoSize() }} • Done</p>
                          <div class="flex items-center gap-2 mt-1">
                            <label class="text-label-sm font-label-sm text-primary hover:underline flex items-center gap-0.5 cursor-pointer">
                              <input type="file" class="sr-only" accept="image/png,image/jpeg" (change)="onFile($any($event.target).files?.[0])" />
                              <span class="material-symbols-outlined text-xs">edit</span> Edit
                            </label>
                            <span class="text-tertiary text-xs">•</span>
                            <button type="button" class="text-label-sm font-label-sm text-secondary hover:underline flex items-center gap-0.5" (click)="removeLogo()">
                              <span class="material-symbols-outlined text-xs">delete</span> Remove
                            </button>
                          </div>
                        } @else {
                          <p class="text-label-md font-label-md text-on-surface">No logo yet</p>
                          <p class="text-body-sm font-body-sm text-tertiary">Initials will be used</p>
                        }
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label class="block text-label-lg font-label-lg text-on-surface mb-2">Salon Type / Classification <span class="text-secondary">*</span></label>
                  <div class="flex flex-wrap gap-2.5" role="radiogroup">
                    @for (c of categories; track c.value) {
                      <label class="cursor-pointer">
                        <input class="peer sr-only" type="radio" name="salon-category" [value]="c.value" [checked]="p().category === c.value" (change)="patch({ category: c.value })" />
                        <div
                          class="px-4 py-2 rounded-lg border text-label-md font-label-md flex items-center gap-1.5 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary"
                          [class]="p().category === c.value ? 'border-primary bg-primary text-on-primary shadow-sm' : 'border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:border-primary hover:bg-surface-container-low'"
                        >
                          <span class="material-symbols-outlined text-base" [class.text-tertiary]="p().category !== c.value">{{ c.icon }}</span>
                          {{ c.value }}
                        </div>
                      </label>
                    }
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label class="block text-label-lg font-label-lg text-on-surface mb-1.5" for="phone-number">Business Phone Number <span class="text-secondary">*</span></label>
                    <div class="relative flex rounded-lg shadow-sm">
                      <div class="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-outline-variant/40 bg-surface-container text-body-md font-body-md text-on-surface">
                        <span class="text-sm mr-1">🇮🇳</span> +91
                      </div>
                      <input id="phone-number" type="tel" inputmode="numeric" maxlength="11" [ngModel]="p().phone" name="phone" (ngModelChange)="patch({ phone: $event })" (blur)="touched.set(true)"
                        class="w-full rounded-none rounded-r-lg pl-3 pr-24 py-2.5 border bg-surface-container-lowest text-on-surface text-body-md font-body-md focus:ring-2 focus:outline-none"
                        [class]="phoneOk() || !touched() ? 'border-outline-variant/40 focus:border-primary focus:ring-primary/20' : 'border-error focus:border-error focus:ring-error/20'" />
                      @if (phoneOk()) {
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-semibold">
                            <span class="material-symbols-outlined text-xs text-emerald-700" style="font-variation-settings: 'FILL' 1;">verified</span> Verified
                          </span>
                        </div>
                      }
                    </div>
                    <p class="text-body-sm font-body-sm mt-1" [class]="phoneOk() || !touched() ? 'text-tertiary' : 'text-error'">
                      {{ phoneOk() || !touched() ? 'Clients will receive SMS & WhatsApp confirmations from this line.' : 'Enter a valid 10-digit mobile number.' }}
                    </p>
                  </div>
                  <div>
                    <label class="block text-label-lg font-label-lg text-on-surface mb-1.5" for="email-address">Official Email Address <span class="text-secondary">*</span></label>
                    <div class="relative">
                      <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-tertiary"><span class="material-symbols-outlined text-lg">mail</span></span>
                      <input id="email-address" type="email" name="email" [ngModel]="p().email" (ngModelChange)="patch({ email: $event })" (blur)="touched.set(true)"
                        class="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-surface-container-lowest text-on-surface text-body-md font-body-md focus:ring-2 focus:outline-none"
                        [class]="emailOk() || !touched() ? 'border-outline-variant/40 focus:border-primary focus:ring-primary/20' : 'border-error focus:border-error focus:ring-error/20'" />
                    </div>
                    <p class="text-body-sm font-body-sm mt-1" [class]="emailOk() || !touched() ? 'text-tertiary' : 'text-error'">
                      {{ emailOk() || !touched() ? 'Used for billing receipts and administrative alerts.' : 'Enter a valid email address.' }}
                    </p>
                  </div>
                </div>

                <div class="space-y-4 pt-2">
                  <div class="flex items-center justify-between gap-3">
                    <h3 class="text-headline-sm font-headline-sm text-on-surface flex items-center gap-2">
                      <span class="material-symbols-outlined text-primary text-xl">location_on</span> Physical Address &amp; Map Location
                    </h3>
                    <button type="button" class="text-primary text-label-sm font-label-sm hover:underline flex items-center gap-1 shrink-0" (click)="detect()">
                      <span class="material-symbols-outlined text-sm">my_location</span> Detect My Location
                    </button>
                  </div>
                  <div>
                    <label class="block text-label-md font-label-md text-on-surface mb-1" for="street-address">Street Address / Shop No.</label>
                    <input id="street-address" type="text" name="street" [class]="input" [ngModel]="p().street" (ngModelChange)="patch({ street: $event })" />
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-label-md font-label-md text-on-surface mb-1" for="landmark">Landmark / Area</label>
                      <input id="landmark" type="text" name="landmark" [class]="input" [ngModel]="p().landmark" (ngModelChange)="patch({ landmark: $event })" />
                    </div>
                    <div>
                      <label class="block text-label-md font-label-md text-on-surface mb-1" for="city">City</label>
                      <input id="city" type="text" name="city" [class]="input" [ngModel]="p().city" (ngModelChange)="patch({ city: $event })" />
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-label-md font-label-md text-on-surface mb-1" for="pincode">Postal PIN Code</label>
                      <input id="pincode" type="text" inputmode="numeric" maxlength="6" name="pin" [class]="input" [ngModel]="p().pin" (ngModelChange)="patch({ pin: $event })" />
                    </div>
                    <div>
                      <label class="block text-label-md font-label-md text-on-surface mb-1" for="state-select">State / Union Territory</label>
                      <div class="relative">
                        <select id="state-select" name="state" [class]="input + ' appearance-none pr-8'" [ngModel]="p().state" (ngModelChange)="patch({ state: $event })">
                          @for (s of states; track s[0]) {
                            <option [value]="s[0]">{{ s[1] }}</option>
                          }
                        </select>
                        <span class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-tertiary"><span class="material-symbols-outlined text-sm">expand_more</span></span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-4 rounded-xl border border-outline-variant/30 overflow-hidden bg-surface-container relative">
                    <div class="px-4 py-2.5 bg-surface-container-lowest border-b border-outline-variant/20 flex items-center justify-between text-xs">
                      <div class="flex items-center gap-1.5 text-primary font-semibold">
                        <span class="material-symbols-outlined text-sm text-secondary" style="font-variation-settings: 'FILL' 1;">pin_drop</span>
                        <span>Pin dropped on map</span>
                      </div>
                      <span class="text-tertiary font-mono text-[11px]">{{ coords() }}</span>
                    </div>
                    <div class="relative h-44 w-full bg-[#E5ECE9] overflow-hidden flex items-center justify-center">
                      <div class="absolute inset-0 opacity-40 transition-transform duration-300" [style.transform]="'scale(' + zoom() + ')'">
                        <div class="w-full h-4 bg-white transform -rotate-12 translate-y-16"></div>
                        <div class="w-full h-6 bg-white transform rotate-45 translate-y-8"></div>
                        <div class="h-full w-5 bg-white transform rotate-12 translate-x-32"></div>
                        <div class="h-full w-8 bg-white transform -rotate-45 translate-x-72"></div>
                        <div class="w-20 h-20 bg-emerald-200/50 rounded-lg absolute top-4 right-12 border border-emerald-300"></div>
                        <div class="w-32 h-16 bg-blue-100/60 rounded absolute bottom-2 left-6 border border-blue-200"></div>
                      </div>
                      <div class="relative z-10 flex flex-col items-center animate-bounce">
                        <div class="px-2.5 py-1 bg-inverse-surface text-inverse-on-surface text-label-sm font-label-sm rounded-md shadow-md mb-1 whitespace-nowrap max-w-56 truncate">{{ p().name || 'Your salon' }}</div>
                        <div class="w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center shadow-lg ring-4 ring-secondary/20">
                          <span class="material-symbols-outlined text-base" style="font-variation-settings: 'FILL' 1;">location_on</span>
                        </div>
                        <div class="w-3 h-1 bg-black/30 rounded-full mt-0.5 blur-[1px]"></div>
                      </div>
                      <div class="absolute bottom-3 right-3 flex flex-col gap-1 z-10">
                        <button type="button" aria-label="Zoom in" class="w-7 h-7 bg-surface-container-lowest rounded-md shadow flex items-center justify-center text-on-surface hover:bg-surface-container-low font-bold text-sm" (click)="zoomBy(0.25)">+</button>
                        <button type="button" aria-label="Zoom out" class="w-7 h-7 bg-surface-container-lowest rounded-md shadow flex items-center justify-center text-on-surface hover:bg-surface-container-low font-bold text-sm" (click)="zoomBy(-0.25)">-</button>
                      </div>
                      <div class="absolute bottom-3 left-3 z-10">
                        <button type="button" class="px-2.5 py-1 bg-surface-container-lowest/95 backdrop-blur text-label-sm font-label-sm rounded-md border border-outline-variant/40 text-on-surface shadow-sm hover:bg-surface-container flex items-center gap-1" (click)="detect()">
                          <span class="material-symbols-outlined text-xs text-primary">drag_pan</span> Refine with my location
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
          </div>

          <div class="lg:col-span-4 space-y-6">
            <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-level-1 border border-outline-variant/20">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <span class="material-symbols-outlined text-primary text-lg">smartphone</span>
                  <h2 class="text-label-lg font-label-lg text-on-surface">Client Discovery Preview</h2>
                </div>
                <span class="text-label-sm font-label-sm px-2 py-0.5 bg-surface-container text-tertiary rounded-full">Mobile Feed</span>
              </div>
              <p class="text-body-sm font-body-sm text-tertiary mb-4">Here is how your storefront appears to clients searching for salons.</p>
              <div class="bg-surface-container-low p-3 rounded-2xl border border-outline-variant/30 max-w-xs mx-auto">
                <div class="bg-surface-container-lowest rounded-xl overflow-hidden shadow-level-1 border border-outline-variant/20">
                  <div class="h-32 bg-surface-container relative">
                    <div class="w-full h-full bg-linear-to-tr from-primary/30 to-surface-container-highest flex items-center justify-center text-outline">
                      <span class="material-symbols-outlined text-4xl text-primary/40">storefront</span>
                    </div>
                    <div class="absolute -bottom-3 left-3 w-10 h-10 rounded-lg bg-surface-container-lowest border-2 border-white shadow-sm overflow-hidden p-0.5">
                      <app-salon-mark size="sm" />
                    </div>
                    <div class="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-inverse-surface/80 backdrop-blur text-inverse-on-surface text-[10px] font-medium flex items-center gap-0.5">
                      <span class="material-symbols-outlined text-[10px]">near_me</span> 1.2 km
                    </div>
                  </div>
                  <div class="p-3 pt-4">
                    <div class="flex items-center justify-between">
                      <span class="text-[11px] font-semibold text-primary uppercase tracking-wider">{{ previewCategory() }}</span>
                      <div class="flex items-center text-amber-600 gap-0.5 text-xs font-bold">
                        <span class="material-symbols-outlined text-sm text-amber-500" style="font-variation-settings: 'FILL' 1;">star</span> New
                      </div>
                    </div>
                    <h4 class="font-headline-sm text-sm font-bold text-on-surface truncate mt-0.5">{{ p().name || 'Your salon name' }}</h4>
                    <p class="text-[11px] text-tertiary truncate">{{ areaLine() }}</p>
                    <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                      @for (t of previewTags(); track t) {
                        <span class="px-1.5 py-0.5 rounded bg-surface-container text-[10px] text-on-surface-variant font-medium">{{ t }}</span>
                      }
                      @if (store.selectedServices().length > 2) {
                        <span class="px-1.5 py-0.5 rounded bg-surface-container text-[10px] text-on-surface-variant font-medium">+{{ store.selectedServices().length - 2 }} more</span>
                      }
                    </div>
                    <div class="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between">
                      <span class="text-xs font-bold text-on-surface">From ₹{{ minPrice() }}</span>
                      <span class="px-2.5 py-1 rounded-md bg-secondary text-on-secondary text-xs font-semibold">Book</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="bg-surface-container-lowest rounded-2xl p-5 shadow-level-1 border border-outline-variant/20 space-y-4">
              <div class="flex items-center gap-2 text-primary font-headline-sm text-headline-sm">
                <span class="material-symbols-outlined text-amber-500" style="font-variation-settings: 'FILL' 1;">lightbulb</span>
                <h3>Quick Tips for Setup</h3>
              </div>
              <div class="space-y-3">
                <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                  <div class="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold mt-0.5">40%</div>
                  <div>
                    <h4 class="text-label-md font-label-md text-on-surface font-semibold">Boost Visual Discovery</h4>
                    <p class="text-body-sm font-body-sm text-tertiary mt-0.5">Clear salon logos and storefront photos increase client booking conversion by 40%.</p>
                  </div>
                </div>
                <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                  <span class="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">pin_drop</span>
                  <div>
                    <h4 class="text-label-md font-label-md text-on-surface font-semibold">Precise Pinning</h4>
                    <p class="text-body-sm font-body-sm text-tertiary mt-0.5">Accurate map pins reduce missed appointments and direct first-time walk-ins smoothly.</p>
                  </div>
                </div>
                <div class="p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 flex items-start gap-3">
                  <span class="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5">schedule</span>
                  <div>
                    <h4 class="text-label-md font-label-md text-on-surface font-semibold">Next: Menu &amp; Pricing</h4>
                    <p class="text-body-sm font-body-sm text-tertiary mt-0.5">In Step 2, you'll configure your service catalogue and durations.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer class="sticky bottom-0 z-40 bg-surface-container-lowest border-t border-outline-variant/20 shadow-level-2 py-3 px-4 md:px-8 mt-auto">
        <div class="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-label-md font-label-md text-tertiary hidden sm:inline">Step 1 of 4: Salon Details</span>
            <span class="text-outline-variant hidden sm:inline">•</span>
            <span class="text-xs font-medium flex items-center gap-1" [class]="valid() ? 'text-primary' : 'text-secondary'">
              <span class="material-symbols-outlined text-sm">{{ valid() ? 'check_circle' : 'error' }}</span>
              {{ valid() ? 'All required inputs valid' : 'Complete the required fields' }}
            </span>
          </div>
          <div class="flex items-center gap-3">
            <button type="button" (click)="saveDraft()" class="px-5 py-2.5 rounded-lg border border-primary text-primary text-label-lg font-label-lg hover:bg-primary/5 active:scale-[0.99] transition-all flex items-center gap-1.5">
              <span class="material-symbols-outlined text-base">save</span> Save Draft
            </button>
            <button type="button" (click)="next()" class="px-6 py-2.5 rounded-lg bg-primary text-on-primary text-label-lg font-label-lg hover:bg-primary-container active:scale-[0.99] transition-all shadow-md flex items-center gap-2">
              <span>Continue to Services</span>
              <span class="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  `,
})
export class SalonStep {
  protected readonly store = inject(SalonStore);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly input = INPUT;
  protected readonly states = STATES;
  protected readonly categories = CATEGORIES;

  protected readonly p = this.store.profile;
  protected readonly touched = signal(false);
  protected readonly dragging = signal(false);
  protected readonly zoom = signal(1);
  protected readonly logoName = signal('logo');
  protected readonly logoSize = signal('');

  protected readonly nameOk = computed(() => this.p().name.trim().length >= 2);
  protected readonly phoneOk = computed(() => this.p().phone.replace(/\D/g, '').length === 10);
  protected readonly emailOk = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.p().email.trim()));
  protected readonly pinOk = computed(() => !this.p().pin || /^\d{6}$/.test(this.p().pin));
  protected readonly valid = computed(() => this.nameOk() && this.phoneOk() && this.emailOk() && this.pinOk());

  protected readonly coords = computed(() => {
    const { lat, lng } = this.p();
    return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
  });
  protected readonly savedLabel = computed(() => {
    const t = this.store.lastSaved();
    return t ? `Auto-saved ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Changes save automatically';
  });
  protected readonly previewCategory = computed(() => this.categories.find((c) => c.value === this.p().category)?.preview ?? '');
  protected readonly areaLine = computed(() => [this.p().landmark.split(',').pop()?.trim(), this.p().city].filter(Boolean).join(', '));
  protected readonly previewTags = computed(() => this.store.selectedServices().slice(0, 2).map((s) => s.name.split(' ').slice(0, 2).join(' ')));
  protected readonly minPrice = computed(() => (this.store.selectedServices().length ? Math.min(...this.store.selectedServices().map((s) => s.price)) : 0));

  patch(v: Partial<SalonProfile>) {
    this.store.patchProfile(v);
  }

  zoomBy(d: number) {
    this.zoom.update((z) => Math.min(1.75, Math.max(0.75, z + d)));
  }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.dragging.set(false);
    this.onFile(e.dataTransfer?.files?.[0]);
  }

  onFile(file: File | undefined | null) {
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type)) return this.toast.error('Logo must be a PNG or JPG image.');
    if (file.size > 5 * 1024 * 1024) return this.toast.error('Logo must be 5MB or smaller.');
    const reader = new FileReader();
    reader.onload = () => {
      this.logoName.set(file.name);
      this.logoSize.set(file.size > 1024 * 1024 ? (file.size / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(file.size / 1024)) + ' KB');
      this.patch({ logo: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.patch({ logo: null });
  }

  detect() {
    if (!navigator.geolocation) return this.toast.error('Location is not supported in this browser.');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.patch({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        this.toast.success('Location pinned on the map');
      },
      () => this.toast.error('Could not get your location. Check browser permissions.'),
    );
  }

  saveDraft() {
    this.store.markSaved();
    this.toast.success('Draft saved');
  }

  next() {
    this.touched.set(true);
    if (!this.valid()) return this.toast.error('Please fix the highlighted fields.');
    this.router.navigateByUrl('/owner/onboarding/services');
  }
}
