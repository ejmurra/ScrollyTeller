import { Observable, BehaviorSubject, Subscription, combineLatest, fromEvent, of } from "rxjs";
import { distinctUntilChanged, debounceTime, bufferCount, filter, map, switchMap, } from "rxjs/operators";

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

export interface iScene {
    screenLengths: number;
    graphicContainer: HTMLDivElement;
    // textContainer: HTMLDivElement;
    activate(params: SceneActivationParams): Subscription[];
    deactivate(subs: Subscription[]): void;
    mount(params: SceneMountParams): void;
}

export type GraphicParams = {
    scenes: {[id: string]: iScene};
    sceneOrder: string[];
    mountPoint: string;
    text: any[];
    debug?: boolean;
    sceneBuffer?: number;
}

export class Graphic {
    private scenes: {[id: string]: iScene} = {};
    private sceneOrder: string[] = [];
    private resize$: BehaviorSubject<Window>;
    private screenHeight$: BehaviorSubject<number>;
    private fallback$: BehaviorSubject<boolean>;
    private scrollPos$: Observable<number>;
    private scrollRel$: Observable<DOMRect>;
    private totalScreenLengths: number;
    private vizPlate: HTMLDivElement;
    private textPlate: HTMLDivElement;
    private sceneBuffer: number;
    private text: any[];
    private isMounted: boolean = false;
    private activeSteps: any[] = [];
    private b1: HTMLDivElement;
    private b2: HTMLDivElement;

    private cancelOnUnmount: Subscription[] = [];

    constructor({scenes, sceneOrder, debug, mountPoint, sceneBuffer, text}: GraphicParams) {
        this.scenes = scenes;
        this.text = text;
        this.sceneOrder = sceneOrder;
        this.resize$ = new BehaviorSubject(window)
        this.screenHeight$ = new BehaviorSubject(window.innerHeight - 50);
        this.fallback$ = new BehaviorSubject(false);
        // This adds a default half screen-length buffer before and after the graphic
        this.sceneBuffer = sceneBuffer || .5
        this.totalScreenLengths = Object.entries(scenes).map(([k, v]) => v.screenLengths + this.sceneBuffer).reduce((a, c) => a + c, 0);
        this.scrollPos$ = fromEvent(document, "scroll").pipe(switchMap(x => of(window.scrollY)));
        this.textPlate = document.createElement("div")
        this.vizPlate = document.createElement("div");
        // Spacer elements for before an after the graphic
        this.b1 = document.createElement("div");
        this.b2 = document.createElement("div");

        // Set up scroll notification
        const anchor = document.getElementById(mountPoint);
        if (!anchor) throw new Error(`Cannot find mount point ${mountPoint}`);
        this.scrollRel$ = this.scrollPos$.pipe(map<number, DOMRect>((_) => anchor.getBoundingClientRect()));

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
                    ["resize", this.resize$],
                    ["scrollPos", this.scrollPos$],
                    ["scrollRel", this.scrollRel$],
                    ["fallback", this.fallback$],
                    ["screenHeight", this.screenHeight$]
                ].map(([name, sub]) => (<any>sub).subscribe(log(name)))
            )
        }
    }

    public setFallback(v: boolean): void {
        this.fallback$.next(v);
    }

    public mount(id: string): void {
        let initialHeight = window.innerHeight;
        if (!this.isMounted) {
            this.initializePlateStyles(id);
        }

        this.listenResize(initialHeight);

        // TODO: Attach text

        this.attachSceneContainers();

        this.activateAllScenes();
        this.isMounted = true;
    }

    private activateAllScenes() {
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

            const progress$ = combineLatest([this.scrollRel$, this.screenHeight$]).pipe(
                map(([pos, height]) => {
                    const viewMid = ((pos.top) - height / 2) + (offsetScreens * height);
                    const totalHeight = scene.screenLengths * height;
                    // console.log(totalHeight)
                    if (viewMid >= 0) return 0;
                    return (-viewMid / totalHeight) > 1 ? 1 : -viewMid / totalHeight
                }),
                distinctUntilChanged()
            )

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
                            scene.graphicContainer.classList.add("hidden-scene")
                        } else {
                            scene.graphicContainer.classList.remove("hidden-scene")
                        }
                    } else {
                        if (p === 0) {
                            scene.graphicContainer.classList.add("hidden-scene");
                        } else {
                            scene.graphicContainer.classList.remove("hidden-scene");
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
                if (x.innerHeight > initialHeight && x.innerHeight - initialHeight <= 60) {
                    this.vizPlate.style.marginTop = `${x.innerHeight - initialHeight}px`;
                } else if (x.innerHeight == initialHeight) {
                    this.vizPlate.style.marginTop = "0px";
                }
                return this.screenHeight$.next(Math.abs(x.innerHeight - initialHeight) <= 60 ? initialHeight : x.innerHeight)
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
            this.b1.style.height = `${x * this.sceneBuffer}`
            this.b2.style.height = `${x * this.sceneBuffer}`
        }));
    }

    private initializePlateStyles(id: string) {
        const m = document.getElementById(id);
        m.appendChild(this.vizPlate);
        m.appendChild(this.textPlate);
        this.textPlate.style.zIndex = "10";
        this.vizPlate.style.zIndex = "1";
        this.textPlate.style.position = "relative";
        this.vizPlate.style.position = "fixed";
        this.textPlate.style.top = "0";
        this.vizPlate.style.top = "0";
        this.textPlate.style.left = "0";
        this.vizPlate.style.left = "0";
        this.textPlate.style.width = "100%";
        this.vizPlate.style.width = "100%";
        this.vizPlate.classList.add("viz-plate");
        this.textPlate.classList.add("text-plate");
    }

    public unmount(): void {
        for (let sub of this.cancelOnUnmount) {
            sub.unsubscribe();
        }
    }

    private adjustStepHeight(x: number) {
        for (let step of this.activeSteps) {
            step.el.style.top = `${x * step.screenLengthPos}px`
        }
    }



    private getContainersForScene(id: string): {graphicContainer: HTMLDivElement} {
        const s = this.scenes[id];
        if (!s) {
            throw new Error(`No scene registered with id ${id}`);
        }
        return {
            graphicContainer: s.graphicContainer
        }
    }

    private static isKonamiCode(buffer) {
        return [38, 38, 40, 40, 37, 39, 37, 39, 66, 65].toString() === buffer.toString();
    }
}