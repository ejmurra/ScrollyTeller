/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import { Subject } from "rxjs-es/Subject";

export class EventEmitter<T> extends Subject<T> {
  // TODO: mark this as internal once all the facades are gone
  // we can't mark it as internal now because EventEmitter exported via @angular/core would not
  // contain this property making it incompatible with all the code that uses EventEmitter via
  // facades, which are local to the code and do not have this property stripped.
  // tslint:disable-next-line
  __isAsync: boolean;

  /**
   * Creates an instance of [EventEmitter], which depending on [isAsync],
   * delivers events synchronously or asynchronously.
   */
  constructor(isAsync: boolean = false) {
    super();
    this.__isAsync = isAsync;
  }

  emit(value?: T) { super.next(value); }

  subscribe(generatorOrNext?: any, error?: any, complete?: any): any {
    let schedulerFn: (t: any) => any;
    let errorFn = (err: any): any => null;
    let completeFn = (): any => null;

    if (generatorOrNext && typeof generatorOrNext === 'object') {
      schedulerFn = this.__isAsync ? (value: any) => {
        setTimeout(() => generatorOrNext.next(value));
      } : (value: any) => { generatorOrNext.next(value); };

      if (generatorOrNext.error) {
        errorFn = this.__isAsync ? (err) => { setTimeout(() => generatorOrNext.error(err)); } :
          (err) => { generatorOrNext.error(err); };
      }

      if (generatorOrNext.complete) {
        completeFn = this.__isAsync ? () => { setTimeout(() => generatorOrNext.complete()); } :
          () => { generatorOrNext.complete(); };
      }
    } else {
      schedulerFn = this.__isAsync ? (value: any) => { setTimeout(() => generatorOrNext(value)); } :
        (value: any) => { generatorOrNext(value); };

      if (error) {
        errorFn =
          this.__isAsync ? (err) => { setTimeout(() => error(err)); } : (err) => { error(err); };
      }

      if (complete) {
        completeFn =
          this.__isAsync ? () => { setTimeout(() => complete()); } : () => { complete(); };
      }
    }

    return super.subscribe(schedulerFn, errorFn, completeFn);
  }
}