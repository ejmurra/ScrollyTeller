import { Observable, BehaviorSubject, Subscription, combineLatest, fromEvent, of, interval } from "rxjs";
import { distinctUntilChanged, debounceTime, bufferCount, filter, map, switchMap, } from "rxjs/operators";
import { scaleLinear } from "d3-scale";

export const log = (...args: any[]) => <T>(data: T): T => {
    console.log.apply(null, args.concat([data]))
    return data;
}

export type SceneActivationParams = {
    resize$: Observable<Window>;
    screenHeight$: BehaviorSubject<number>;
    fallback$: BehaviorSubject<boolean>;
    progress$: Observable<number>;
    progressDebounceMilli?: number;
    id: string;
}

export type SceneMountParams = {
    vizPlate: HTMLDivElement;
}

export interface TextItem {
    elType: string;
    text: string;
    screens: number;
}

export interface iScene {
    screenLengths: number;
    graphicContainer: HTMLDivElement;
    text: TextItem[];
    activate(params: SceneActivationParams): Subscription[];
    deactivate(subs: Subscription[]): void;
    mount(params: SceneMountParams): void;
}

export type GraphicParams = {
    scenes: {[id: string]: iScene};
    sceneOrder: string[];
    mountPoint: string;
    // text: any[];
    debug?: boolean;
    sceneBuffer?: number;
    hiddenClass?: string;
    isMobile?: boolean;
}

export type ActiveStep = {
    el: HTMLDivElement;
    screenLengthPos: number;
}

export class Graphic {
    private scenes: {[id: string]: iScene} = {};
    private sceneOrder: string[] = [];
    private resize$: BehaviorSubject<Window>;
    private screenHeight$: BehaviorSubject<number>;
    private fallback$: BehaviorSubject<boolean>;
    private scrollPos$: Observable<number>;
    private headerBuffer = 50;
    // private scrollRel$: Observable<number>;
    private totalScreenLengths: number;
    private vizPlate: HTMLDivElement;
    private textPlate: HTMLDivElement;
    private sceneBuffer: number;
    private steps: any[];
    private activeSteps: ActiveStep[] = [];
    // private text: any[];
    private isMobile: boolean;
    private isMounted: boolean = false;
    private hiddenClass: string = "hidden-scene"
    // private b1: HTMLDivElement;
    // private b2: HTMLDivElement;
    private mountPoint: string;
    private anchorPos$: Observable<number>;
    private initialHeight: number;

    private cancelOnUnmount: Subscription[] = [];

    constructor({scenes, sceneOrder, debug, mountPoint, sceneBuffer, hiddenClass, isMobile}: GraphicParams) {
        this.scenes = scenes;
        this.hiddenClass = hiddenClass || "hidden-scene";
        this.sceneOrder = sceneOrder;
        this.resize$ = new BehaviorSubject(window)
        this.screenHeight$ = new BehaviorSubject(window.innerHeight - 50);
        this.fallback$ = new BehaviorSubject(false);
        this.mountPoint = mountPoint;
        if (isMobile) {
            this.isMobile = true;
        }
        this.initialHeight = window.innerHeight;
        // This adds a default half screen-length buffer before and after the graphic
        this.sceneBuffer = sceneBuffer || .5
        this.totalScreenLengths = Object.entries(scenes).map(([k, v]) => v.screenLengths + this.sceneBuffer).reduce((a, c) => a + c, 0);
        this.scrollPos$ = fromEvent(document, "scroll").pipe(switchMap(x => of(window.scrollY)));
        this.textPlate = document.createElement("div")
        this.vizPlate = document.createElement("div");
        // Spacer elements for before an after the graphic
        // this.b1 = document.createElement("div");
        // this.b2 = document.createElement("div");
        this.steps = this.sceneOrder.map(x => this.scenes[x])
            .reduce((a, e) => {
                    let t = e.text.map(x => ({...x, screens: a["s"] + x.screens}))
                    a["s"] += e.screenLengths;
                    a["t"] = [...a["t"], ...t]
                    return a;
                }, {s: 0, t: []}
            ).t;


        // Set up scroll notification
        const anchor = document.getElementById(mountPoint);
        if (!anchor) throw new Error(`Cannot find mount point ${mountPoint}`);

        this.anchorPos$ = interval(500).pipe(
            map<any, number>(() => anchor.getBoundingClientRect().top + window.scrollY),
            distinctUntilChanged()
        )

        if (debug) {
            this.cancelOnUnmount.push(
                fromEvent<KeyboardEvent>(document, "keydown").pipe(
                    map<KeyboardEvent, number>(e => e.keyCode),
                    bufferCount(10, 1),
                    filter(Graphic.isKonamiCode)
                ).subscribe(v => this.setFallback(!this.fallback$.getValue()))
            );

            // debug logging
            this.cancelOnUnmount = this.cancelOnUnmount.concat(
                [
                    // ["resize", this.resize$],
                    // ["scrollPos", this.scrollPos$],
                    // ["fallback", this.fallback$],
                    // ["screenHeight", this.screenHeight$],
                    // [`${mountPoint}-anchorPos`, this.anchorPos$]
                ].map(([name, sub]) => (<any>sub).subscribe(log(name)))
            )
        }
    }

    public setFallback(v: boolean): void {
        this.fallback$.next(v);
    }

    public mount(): void {
        this.initialHeight = window.innerHeight;
        if (!this.isMounted) {
            this.initializePlateStyles(this.mountPoint);
        }

        // this.screenHeight$.next(initialHeight);

        this.listenResize(this.initialHeight);

        this.attachText()

        this.attachSceneContainers();

        this.activateAllScenes();
        this.isMounted = true;
    }

    // public run(debug = false): void {
    //     if (this.isMounted) {
    //         this.activateAllScenes(debug);
    //     }
    // }

    public unmount(): void {
        for (let sub of this.cancelOnUnmount) {
            sub.unsubscribe();
        }
    }

    private attachText(): void {
        for (let step of this.steps) {
            if (!this.isMounted) {
                if (step.elType !== "h1") {
                    const p = document.createElement(step.elType);
                    p.classList.add("stepper-text")
                    p.innerHTML = step.text;
                    const d = document.createElement("div")
                    d.classList.add("step")
                    d.append(p)
                    this.textPlate.append(d);
                    this.activeSteps.push({
                        el: d,
                        screenLengthPos: step.screens
                    })
                }
                if (step.elType === "h1") {
                    const container = document.createElement("p")
                    container.classList.add("byline-block");
                    const b1 = document.createElement("span")
                    const b2 = document.createElement("span")
                    const d = document.createElement("span")
                    b1.classList.add("byline1")
                    b2.classList.add("byline2")
                    d.classList.add("dateline")
                    b1.innerHTML = step.byline1
                    b2.innerHTML = step.byline2
                    d.innerHTML = step.date;
                    container.append(b1)
                    container.append(b2)
                    container.append(d)
                    const x = document.createElement("div")
                    const h1 = document.createElement("h1")
                    h1.innerHTML = step.text;
                    x.append(h1);
                    x.append(container);
                    x.classList.add("step");
                    x.classList.add("title-step");
                    this.textPlate.append(x)
                    this.activeSteps.push({
                        el: x,
                        screenLengthPos: step.screens,
                    })
                }
            }
        }

        this.cancelOnUnmount.push(this.screenHeight$.subscribe(s => this.adjustStepheight(s)));
    }

    private adjustStepheight(x: number) {
        // const anchor = document.getElementById(this.mountPoint).getBoundingClientRect();
        for (let step of this.activeSteps) {
            step.el.style.top = `${x * step.screenLengthPos}px`
        }
    }

    private activateAllScenes() {
        // const anchor = document.getElementById(this.mountPoint).getBoundingClientRect();
        this.sceneOrder.map((id, index) => {
            const scene = this.scenes[id];
            let offsetScreens = 0;
            if (index > 0) {
                const prevScenes = this.sceneOrder.slice(0, index);
                for (let s of prevScenes) {
                    offsetScreens += this.scenes[s].screenLengths
                }
            }
            // offsetScreens += this.screenBuffer

            const progress$ = combineLatest([this.scrollPos$, this.screenHeight$, this.anchorPos$]).pipe(
                map(([pos, height, anchorTop]) => {
                    const totalHeight = scene.screenLengths * height;
                    let s = scaleLinear().domain([anchorTop + this.headerBuffer, anchorTop + this.headerBuffer + totalHeight + height]).range([0, 1]).clamp(true);
                    return s(pos)
                }),
                distinctUntilChanged()
            )

            // if (debug) {
            //     this.cancelOnUnmount = this.cancelOnUnmount.concat(
            //         [
            //             ["progress", progress$],
            //             ["anchorTop", this.anchorPos$],
            //             ["position", this.scrollPos$]
            //         ].map(([name, sub]) => (<any>sub).subscribe(log(name)))
            //     )
            // }


            scene.activate({
                resize$: this.resize$,
                screenHeight$: this.screenHeight$,
                fallback$: this.fallback$,
                progress$,
                id
            })

            this.cancelOnUnmount.push(
                progress$.subscribe(p => {
                    if (index === 0) {
                        if (p === 1) {
                            scene.graphicContainer.classList.add(this.hiddenClass)
                        } else {
                            scene.graphicContainer.classList.remove(this.hiddenClass)
                        }
                    } else {
                        if (p === 0) {
                            scene.graphicContainer.classList.add(this.hiddenClass);
                        } else {
                            scene.graphicContainer.classList.remove(this.hiddenClass);
                        }
                    }
                })
            )
        })
    }

    private attachSceneContainers() {
        this.sceneOrder.map((id, index) => {
            const scene = this.scenes[id];
            if (!this.isMounted) {
                scene.graphicContainer.classList.add(`${id}-viz`);
                scene.graphicContainer.classList.add("viz");
                scene.graphicContainer.style.zIndex = `${100 - index}`;
                this.vizPlate.append(scene.graphicContainer);
            }
            scene.mount({vizPlate: scene.graphicContainer})
        })
    }

    private listenResize(initialHeight: number) {
        this.cancelOnUnmount.push(
            this.resize$.subscribe(x => {
                // if (x.innerHeight > initialHeight && x.innerHeight - initialHeight <= 60) {
                //     this.vizPlate.style.marginTop = `${x.innerHeight - initialHeight}px`;
                // } else if (x.innerHeight == initialHeight) {
                //     this.vizPlate.style.marginTop = "0px";
                // }
                return this.isMobile ?
                    this.screenHeight$.next(Math.abs(x.innerHeight - initialHeight) <= 60 ? initialHeight : x.innerHeight)
                    : this.screenHeight$.next(this.initialHeight);
            })
        );
        this.cancelOnUnmount.push(
            fromEvent<Event>(window, "resize").pipe(
                debounceTime(100),
                map<Event, Window>(e => <Window>e.target)
            ).subscribe(this.resize$)
        )
        this.cancelOnUnmount.push(this.screenHeight$.subscribe(x => {
            this.textPlate.style.height = `${x * this.totalScreenLengths}px`;
            this.vizPlate.style.height = `${x}px`;
            // this.b1.style.height = `${x * this.sceneBuffer}`
            // this.b2.style.height = `${x * this.sceneBuffer}`
        }));
    }

    private initializePlateStyles(id: string) {
        const m = document.getElementById(id);
        this.vizPlate.classList.add("viz-plate");
        this.textPlate.classList.add("text-plate");
        m.appendChild(this.vizPlate);
        m.appendChild(this.textPlate);
    }



    private static isKonamiCode(buffer) {
        return [38, 38, 40, 40, 37, 39, 37, 39, 66, 65].toString() === buffer.toString();
    }
}