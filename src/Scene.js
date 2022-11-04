// noinspection JSUnusedGlobalSymbols
import { BehaviorSubject, combineLatest, fromEvent, of } from "rxjs";
import { select } from "d3";
import { debounceTime, distinctUntilChanged, withLatestFrom, throttleTime, switchMap, } from "rxjs/operators";
// Decorator function
export function step(id) {
    return function (target, propertyKey) {
        target.fmap = target.fmap || {};
        target.fmap[id] = propertyKey;
    };
}
export class Stage {
    start;
    end;
    screens;
    steps;
    stageProgress$;
    constructor(p) {
        this.screens = p.steps[p.steps.length - 1].screenLengthPos;
        this.stageProgress$ = new BehaviorSubject("init");
        this.steps = p.steps;
    }
    activate(params) {
        let subs = [];
        const { state } = params;
        subs.push(combineLatest([params.stageProgress$.pipe(distinctUntilChanged()), params.resize$])
            .subscribe(([p, r]) => {
            try {
                this[Object.getPrototypeOf(this).fmap[p]](r, { state });
            }
            catch (e) {
                console.error(e);
                console.error(`no fmap for id ${p}`);
            }
        }));
        return subs;
    }
    mount(p) {
        return p;
    }
}
export class StageScene {
    screenLengths = 0;
    graphicContainer;
    steps = [];
    stages;
    stageOrder;
    state;
    constructor(p) {
        this.screenLengths = p.screenLengths;
        this.stages = p.stages;
        this.stageOrder = p.stageOrder;
        this.graphicContainer = document.createElement("div");
        this.graphicContainer.style.width = "100%";
        this.graphicContainer.style.height = "100%";
        this.graphicContainer.style.position = "absolute";
        this.graphicContainer.style.top = "0";
        this.graphicContainer.style.left = "0";
        this.initStages();
    }
    activate(params) {
        let subs = [];
        for (let stage of Object.values(this.stages)) {
            subs = [
                ...subs,
                ...stage.activate({
                    ...params,
                    stageProgress$: stage.stageProgress$,
                    state: this.state
                })
            ];
        }
        // If we generalize this class to just pass a state value, resizing the svg must be done by the subclass
        //
        // subs.push(params.resize$.subscribe(r => {
        //     this.selections.svg.attr("width", `${r.innerWidth}px`);
        //     this.selections.svg.attr("height", `${r.innerHeight}px`);
        // }));
        subs.push(params.progress$.pipe(debounceTime(params.progressDebounceMilli || 100)).subscribe(p => {
            const currentScreen = p * (this.screenLengths) - .5; // Move it half a screenlength so the scene triggers as the text reaches the center
            if (currentScreen < .01) {
                for (let stage of Object.values(this.stages)) {
                    stage.stageProgress$.next("init");
                }
            }
            else {
                let v = this.steps.reduce(({ current }, step) => {
                    if (currentScreen >= step.screenLengthPos) {
                        return { current: step };
                    }
                    return { current };
                }, { current: this.steps[0] }).current;
                v.stage.stageProgress$.next(v.id);
            }
        }));
        return subs;
    }
    mount(params) {
        const svg = select(params.vizPlate).append("svg");
        this.state["selections"] = { svg };
        for (let id of this.stageOrder) {
            let stage = this.stages[id];
            let { state } = stage.mount({
                state: this.state,
            });
            this.state = state;
        }
    }
    deactivate(subs) {
        for (let sub of subs) {
            sub.unsubscribe();
        }
    }
    initStages() {
        // Space stages
        for (let i = 0; i < this.stageOrder.length; i++) {
            let stage = this.stages[this.stageOrder[i]];
            if (i === 0) {
                stage.start = 0;
                stage.end = stage.screens;
            }
            else if (i === this.stageOrder.length - 1) {
                stage.end = this.screenLengths;
                stage.start = this.stages[this.stageOrder[i - 1]]?.end || 0;
            }
            else {
                let prev = this.stageOrder.slice(i);
                stage.start = prev.reduce((x, y) => {
                    return x + this.stages[y].screens;
                }, 0);
                stage.end = stage.start + stage.screens;
            }
        }
        // Offset stages
        for (let i = 0; i < this.stageOrder.length; i++) {
            let stage = this.stages[this.stageOrder[i]];
            let offset = 0;
            for (let ii of this.stageOrder.slice(0, i)) {
                const pstage = this.stages[ii];
                offset += 1 + pstage.steps[pstage.steps.length - 1].screenLengthPos;
            }
            for (let step of stage.steps) {
                this.steps.push({ screenLengthPos: step.screenLengthPos + offset, stage, id: step.id });
            }
        }
    }
}
export class VideoScene {
    screenLengths = 0;
    graphicContainer;
    textContainer;
    vidEl;
    framerate;
    frameSteps;
    lastDrawn$ = new BehaviorSubject(0);
    lastToDraw$ = new BehaviorSubject([]);
    drain$ = new BehaviorSubject(0);
    remainder$ = new BehaviorSubject([]);
    timeupdate$;
    numFrames;
    isMounted = false;
    constructor(p) {
        this.vidEl = p.vidEl;
        this.framerate = p.framerate;
        this.screenLengths = p.screenLengths;
        this.frameSteps = p.frameSteps;
        // this.steps = p.steps;
        this.numFrames = p.numFrames;
        this.timeupdate$ = fromEvent(this.vidEl, "timeupdate");
        this.graphicContainer = document.createElement("div");
        this.textContainer = document.createElement("div");
        this.graphicContainer.classList.add("vid-container");
        this.graphicContainer.classList.add(window.isMobile.any ? "mobile-vid" : "desktop-vid");
        for (let el of [this.graphicContainer, this.textContainer]) {
            el.style.width = "100%";
        }
        this.graphicContainer.append(this.vidEl);
    }
    activate(params) {
        let subs = [];
        let timesToDraw$ = params.progress$.pipe(throttleTime(100), distinctUntilChanged(), withLatestFrom(this.lastDrawn$), switchMap(([scrollPct, lastDrawn]) => {
            const targetFrame = this.numFrames * scrollPct;
            const frameDiff = (targetFrame - lastDrawn) / this.frameSteps;
            const times = [];
            for (let i = 1; i < this.frameSteps + 1; i++) {
                times.push(lastDrawn + (i * frameDiff));
            }
            return of(times);
        }));
        this.timeupdate$.pipe(debounceTime(20), withLatestFrom(timesToDraw$, this.lastToDraw$, this.remainder$)).subscribe(([_, t, l, r]) => {
            // If t and l are the same, continue to drain r
            if (JSON.stringify(t) === JSON.stringify(l)) {
                const d = r.shift();
                this.drain$.next(d);
                // If remainders is drained, repopulate with last value so that "timeupdate" keeps ticking
                this.remainder$.next(r);
                // Else, set l = t, r = t, and drain the first of t
            }
            else {
                this.remainder$.next(t.slice(1));
                this.lastToDraw$.next(t);
                this.drain$.next(t[0]);
            }
        });
        this.drain$.subscribe(this.update.bind(this));
        subs.push(params.progress$.pipe(throttleTime(1000)).subscribe(_ => this.vidEl.dispatchEvent(new Event("timeupdate"))));
        return subs;
    }
    update(t) {
        // If this frame hasn't been drawn yet, draw it
        if (t && t !== this.vidEl.currentTime) {
            this.vidEl.currentTime = t / this.framerate;
            this.lastDrawn$.next(t);
        }
        else {
            // Otherwise kick the engine again so it turns over next frame
            setTimeout(() => this.vidEl.dispatchEvent(new Event("timeupdate")));
        }
    }
    mount(params) {
        if (!this.isMounted) {
            params.vizPlate.append(this.vidEl);
            this.vidEl.pause();
        }
        this.isMounted = true;
    }
    deactivate(subs) {
        for (let sub of subs) {
            sub.unsubscribe();
        }
    }
}
//# sourceMappingURL=Scene.js.map