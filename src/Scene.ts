// noinspection JSUnusedGlobalSymbols

import { iScene, SceneActivationParams, SceneMountParams } from "./Graphic";
import { BehaviorSubject, combineLatest, Observable, Subscription, fromEvent, of } from "rxjs";
import { select } from "d3";
import { debounceTime, distinctUntilChanged, withLatestFrom, throttleTime, switchMap, } from "rxjs/operators";

export type SceneParams = {
    screenLengths: number,
}

export type StageParams = {
    stageOrder: string[],
    stages: { [id: string]: Stage };
}

export type StageActivationParams = {
    stageProgress$: Observable<string>;
    state: any;
}

export type StageData = {
    steps: StepData[];
};

export type StepData = {
    id: string;
    screenLengthPos: number;
}

export type StageMountParams = {
    state: any;
}

export interface iStage {
    start: number;
    end: number;
    screens: number;
    steps: StepData[];
    stageProgress$: BehaviorSubject<string>;
    activate(params: StageActivationParams & SceneActivationParams): Subscription[];
    mount(p: StageMountParams): StageMountParams;
}

// Decorator function
export function step(id: string): MethodDecorator {
    return function(target: any, propertyKey: string): void {
        target.fmap = target.fmap || {};
        target.fmap[id] = propertyKey;
    }
}

export class Stage implements iStage {
    start: number;
    end: number;
    screens: number;
    steps: StepData[];
    stageProgress$: BehaviorSubject<string>;

    constructor(p: StageData) {
        this.screens = p.steps[p.steps.length - 1].screenLengthPos;
        this.stageProgress$ = new BehaviorSubject("init");
        this.steps = p.steps;
    }

    activate(params: StageActivationParams & SceneActivationParams): Subscription[] {
        let subs = [];
        const {state} = params;
        subs.push(
            combineLatest([params.stageProgress$.pipe(distinctUntilChanged()), params.resize$])
                .subscribe(([p, r]) => {
                    try {
                        this[Object.getPrototypeOf(this).fmap[p]](r, {state})
                    } catch (e) {
                        console.error(e)
                        console.error(`no fmap for id ${p}`)
                    }

                })
        )
        return subs;
    }

    mount(p: StageMountParams): StageMountParams {
        return p;
    }
}

export class StageScene implements iScene {
    public screenLengths: number = 0;
    public graphicContainer: HTMLDivElement;

    private steps: {screenLengthPos: number, stage: iStage, id: string}[] = [];
    private stages: {[id: string]: iStage}
    private stageOrder: string[];
    private state: any;

    constructor(p: SceneParams & StageParams) {
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

    public activate(params: SceneActivationParams): Subscription[] {
        let subs = [];
        for (let stage of Object.values(this.stages)) {
            subs = [
                ...subs,
                ...stage.activate({
                    ...params,
                    stageProgress$: stage.stageProgress$,
                    state: this.state
                })
            ]
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
            } else {
                let v = this.steps.reduce(({current}, step) => {
                    if (currentScreen >= step.screenLengthPos) {
                        return {current: step}
                    }
                    return {current}
                }, {current: this.steps[0]}).current;
                v.stage.stageProgress$.next(v.id);
            }
        }));
        return subs
    }

    public mount(params: SceneMountParams): void {
        const svg = select(params.vizPlate).append("svg");
        this.state["selections"] = {svg}

        for (let id of this.stageOrder) {
            let stage = this.stages[id];
            let {state} = stage.mount({
                state: this.state,
            })
            this.state = state;
        }
    }

    public deactivate(subs: Subscription[]) {
        for (let sub of subs) {
            sub.unsubscribe();
        }
    }

    private initStages() {
        // Space stages
        for (let i = 0; i < this.stageOrder.length; i++) {
            let stage = this.stages[this.stageOrder[i]]
            if (i === 0) {
                stage.start = 0
                stage.end = stage.screens;
            }
            else if (i === this.stageOrder.length - 1) {
                stage.end = this.screenLengths;
                stage.start = this.stages[this.stageOrder[i - 1]]?.end || 0
            } else {
                let prev = this.stageOrder.slice(i)
                stage.start = prev.reduce((x, y) => {
                    return x + this.stages[y].screens
                }, 0)
                stage.end = stage.start + stage.screens;
            }
        }

        // Offset stages
        for (let i = 0; i < this.stageOrder.length; i++) {
            let stage = this.stages[this.stageOrder[i]]
            let offset = 0;
            for (let ii of this.stageOrder.slice(0, i)) {
                const pstage = this.stages[ii]
                offset += 1 + pstage.steps[pstage.steps.length - 1].screenLengthPos
            }
            for (let step of stage.steps) {
                this.steps.push({screenLengthPos: step.screenLengthPos + offset, stage, id: step.id})
            }
        }
    }
}

export type VideoParams = {
    framerate: number;
    vidEl: HTMLVideoElement;
    frameStepsDesktop: number;
    frameStepsMobile: number;
    numFrames: number;
    isMobile: boolean;
}

export type VideoSceneParams = SceneParams & VideoParams;

export class VideoScene implements iScene {
    public screenLengths = 0;
    public graphicContainer: HTMLDivElement;
    public textContainer: HTMLDivElement;

    private vidEl: HTMLVideoElement;
    private framerate: number;
    private frameStepsDesktop: number;
    private frameStepsMobile: number;

    private lastDrawn$ = new BehaviorSubject<number>(0);
    private lastToDraw$ = new BehaviorSubject<number[]>([]);
    private drain$ = new BehaviorSubject<number>(0)
    private remainder$ = new BehaviorSubject<number[]>([]);
    private timeupdate$: Observable<number>;
    private numFrames: number;
    private isMounted = false;
    private isMobile = false;
    private pinClass = "pinned";

    constructor(p: VideoSceneParams) {
        this.vidEl = p.vidEl
        this.framerate = p.framerate;
        this.screenLengths = p.screenLengths;
        this.frameStepsDesktop = p.frameStepsDesktop;
        this.frameStepsMobile = p.frameStepsMobile;
        // this.steps = p.steps;
        this.numFrames = p.numFrames;
        this.isMobile = p.isMobile

        this.timeupdate$ = fromEvent<number>(this.vidEl, "timeupdate")

        this.graphicContainer = document.createElement("div")
        this.textContainer = document.createElement("div")
        this.graphicContainer.classList.add("vid-container")
        this.graphicContainer.classList.add(this.isMobile ? "mobile-vid" : "desktop-vid")
        this.graphicContainer.classList.add(this.pinClass);
        for (let el of [this.graphicContainer, this.textContainer]) {
            el.style.width = "100%";
        }
        this.graphicContainer.append(this.vidEl);
    }

    activate(params: SceneActivationParams): Subscription[] {
        let subs = [];

        params.progress$.subscribe(p => {
            if (p > 0 && p < 1) {
                this.graphicContainer.classList.add(this.pinClass)
                this.graphicContainer.classList.remove(`not-${this.pinClass}`)
            }
            if (p === 0) {
                this.graphicContainer.classList.remove(this.pinClass)
                this.graphicContainer.classList.add(`not-${this.pinClass}`)
            } else if (p === 1) {
                // TODO: different class to pin to bottom?
                this.graphicContainer.classList.remove(this.pinClass)
                this.graphicContainer.classList.add(`not-${this.pinClass}`)
            }
        })

        let timesToDraw$ = params.progress$.pipe(
            throttleTime(100),
            distinctUntilChanged(),
            withLatestFrom(this.lastDrawn$),
            switchMap(([scrollPct, lastDrawn]) => {
                const steps = this.isMobile ? this.frameStepsMobile : this.frameStepsDesktop
                const targetFrame = this.numFrames * scrollPct;
                const frameDiff = (targetFrame - lastDrawn) / steps;
                const times = []
                for (let i = 1; i < steps + 1; i++) {
                    times.push(lastDrawn + (i * frameDiff))
                }
                return of(times);
            })
        )

        this.timeupdate$.pipe(
            debounceTime(20),
            withLatestFrom(timesToDraw$, this.lastToDraw$, this.remainder$)
        ).subscribe(([_, t, l, r]) => {
            // console.log({t, l, r})
            // If t and l are the same, continue to drain r
            if (JSON.stringify(t) === JSON.stringify(l)) {
                const d = r.shift();
                this.drain$.next(d);
                // If remainders is drained, repopulate with last value so that "timeupdate" keeps ticking
                this.remainder$.next(r);
                // Else, set l = t, r = t, and drain the first of t
            } else {
                this.remainder$.next(t.slice(1));
                this.lastToDraw$.next(t);
                this.drain$.next(t[0]);
            }
        })

        this.drain$.subscribe(this.update.bind(this))

        subs.push(params.progress$.pipe(
            throttleTime(1000)
        ).subscribe(_ => this.vidEl.dispatchEvent(new Event("timeupdate"))))
        return subs;
    }

    private update(t) {
        // If this frame hasn't been drawn yet, draw it
        if (t && t !== this.vidEl.currentTime) {
            this.vidEl.currentTime = t / this.framerate;
            this.lastDrawn$.next(t);
        } else {
            // Otherwise kick the engine again so it turns over next frame
            setTimeout(() => this.vidEl.dispatchEvent(new Event("timeupdate")))
        }
    }

    public mount(params: SceneMountParams): void {
        if (!this.isMounted) {
            params.vizPlate.append(this.vidEl)
            this.vidEl.pause();
        }
        this.isMounted = true;
    }

    public deactivate(subs: Subscription[]) {
        for (let sub of subs) {
            sub.unsubscribe();
        }
    }
}