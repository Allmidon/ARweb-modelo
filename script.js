/* =========================================
   COMPONENTES DE INTERACCIÓN (GESTOS)
   ========================================= */
AFRAME.registerComponent("gesture-detector", {
    schema: { element: { default: "" } },
    init: function() {
        this.targetElement = this.data.element && document.querySelector(this.data.element);
        if (!this.targetElement) { this.targetElement = this.el; }
        this.internalState = { previousState: null };
        this.emitGestureEvent = this.emitGestureEvent.bind(this);
        this.targetElement.addEventListener("touchstart", this.emitGestureEvent);
        this.targetElement.addEventListener("touchend", this.emitGestureEvent);
        this.targetElement.addEventListener("touchmove", this.emitGestureEvent);
    },
    remove: function() {
        this.targetElement.removeEventListener("touchstart", this.emitGestureEvent);
        this.targetElement.removeEventListener("touchend", this.emitGestureEvent);
        this.targetElement.removeEventListener("touchmove", this.emitGestureEvent);
    },
    emitGestureEvent: function(event) {
        const currentState = this.getTouchState(event);
        const previousState = this.internalState.previousState;
        const gestureContinues = previousState && currentState && currentState.touchCount == previousState.touchCount;
        const gestureEnded = previousState && !gestureContinues;
        const gestureStarted = currentState && !gestureContinues;
        if (gestureEnded) {
            const eventName = this.getEventPrefix(previousState.touchCount) + "fingerend";
            this.el.emit(eventName, previousState);
            this.internalState.previousState = null;
        }
        if (gestureStarted) {
            currentState.startTime = performance.now();
            currentState.startPosition = currentState.position;
            currentState.startSpread = currentState.spread;
            const eventName = this.getEventPrefix(currentState.touchCount) + "fingerstart";
            this.el.emit(eventName, currentState);
            this.internalState.previousState = currentState;
        }
        if (gestureContinues) {
            const eventDetail = {
                positionChange: { x: currentState.position.x - previousState.position.x, y: currentState.position.y - previousState.position.y },
                spreadChange: currentState.spread - previousState.spread,
                startSpread: currentState.startSpread,
                position: currentState.position,
                spread: currentState.spread
            };
            const eventName = this.getEventPrefix(currentState.touchCount) + "fingermove";
            this.el.emit(eventName, eventDetail);
            this.internalState.previousState = currentState;
        }
    },
    getTouchState: function(event) {
        if (event.touches.length === 0) return null;
        const touchList = [];
        for (let i = 0; i < event.touches.length; i++) { touchList.push(event.touches[i]); }
        const touchState = { touchCount: touchList.length };
        const centerPosition = touchList.reduce((sum, touch) => ({ x: sum.x + touch.clientX, y: sum.y + touch.clientY }), { x: 0, y: 0 });
        touchState.position = { x: centerPosition.x / touchList.length, y: centerPosition.y / touchList.length };
        if (touchList.length >= 2) {
            const spread = Math.hypot(touchList[0].clientX - touchList[1].clientX, touchList[0].clientY - touchList[1].clientY);
            touchState.spread = spread;
        }
        return touchState;
    },
    getEventPrefix: function(touchCount) {
        const names = ["one", "two", "three", "many"];
        return names[Math.min(touchCount, 4) - 1];
    }
});

AFRAME.registerComponent("gesture-handler", {
    // AQUÍ ESTÁN LOS CAMBIOS EN MINSCALE Y MAXSCALE
    schema: { 
        enabled: { default: true }, 
        rotationFactor: { default: 5 }, 
        minScale: { default: 0.01 }, // Mínimo un poco más grande
        maxScale: { default: 3.0 }   // Máximo mucho más grande (antes era 0.2)
    },
    init: function() {
        this.handleScale = this.handleScale.bind(this);
        this.handleRotation = this.handleRotation.bind(this);
        this.isVisible = false;
        this.el.sceneEl.addEventListener("markerFound", (e) => { this.isVisible = true; });
        this.el.sceneEl.addEventListener("markerLost", (e) => { this.isVisible = false; });
    },
    update: function() {
        if (this.data.enabled) {
            this.el.sceneEl.addEventListener("onefingermove", this.handleRotation);
            this.el.sceneEl.addEventListener("twofingermove", this.handleScale);
        } else {
            this.el.sceneEl.removeEventListener("onefingermove", this.handleRotation);
            this.el.sceneEl.removeEventListener("twofingermove", this.handleScale);
        }
    },
    remove: function() {
        this.el.sceneEl.removeEventListener("onefingermove", this.handleRotation);
        this.el.sceneEl.removeEventListener("twofingermove", this.handleScale);
    },
    handleRotation: function(event) {
        if (this.isVisible) {
            const sensitivity = 0.005; 
            this.el.object3D.rotation.y += event.detail.positionChange.x * this.data.rotationFactor * sensitivity;
            this.el.object3D.rotation.x += event.detail.positionChange.y * this.data.rotationFactor * sensitivity;
        }
    },
    handleScale: function(event) {
        if (this.isVisible) {
            const scaleChange = event.detail.spreadChange;
            let scaleMultiplier = 1;
            if (scaleChange > 0) { scaleMultiplier = 1.05; } else if (scaleChange < 0) { scaleMultiplier = 0.95; }
            
            let currentScaleX = this.el.object3D.scale.x; 
            let currentScaleY = this.el.object3D.scale.y; 
            let currentScaleZ = this.el.object3D.scale.z;
            
            let newScaleX = currentScaleX * scaleMultiplier; 
            let newScaleY = currentScaleY * scaleMultiplier; 
            let newScaleZ = currentScaleZ * scaleMultiplier;
            
            // Aplica los límites definidos en el schema
            newScaleX = Math.min(Math.max(newScaleX, this.data.minScale), this.data.maxScale);
            newScaleY = Math.min(Math.max(newScaleY, this.data.minScale), this.data.maxScale);
            newScaleZ = Math.min(Math.max(newScaleZ, this.data.minScale), this.data.maxScale);
            
            this.el.object3D.scale.set(newScaleX, newScaleY, newScaleZ);
        }
    }
});

/* =========================================
   COMPONENTE PARA CAPTURA DE PANTALLA
   ========================================= */
AFRAME.registerComponent("screenshot-handler", {
    init: function() {
        const button = document.getElementById('snap-button');
        if (button) {
            button.addEventListener('click', this.takeScreenshot.bind(this));
        }
    },

    takeScreenshot: function() {
        const scene = this.el.sceneEl;
        const video = document.querySelector('video');
        const canvas = scene.canvas;

        if (!video || !canvas) {
            console.error("No se encontró el video o el canvas para la captura.");
            return;
        }

        try {
            const mergedCanvas = document.createElement('canvas');
            mergedCanvas.width = canvas.width;
            mergedCanvas.height = canvas.height;
            const ctx = mergedCanvas.getContext('2d');

            const videoAspect = video.videoWidth / video.videoHeight;
            const canvasAspect = canvas.width / canvas.height;
            let drawWidth, drawHeight, startX, startY;

            if (canvasAspect > videoAspect) {
                drawWidth = canvas.width;
                drawHeight = canvas.width / videoAspect;
                startX = 0;
                startY = (canvas.height - drawHeight) / 2;
            } else {
                drawWidth = canvas.height * videoAspect;
                drawHeight = canvas.height;
                startX = (canvas.width - drawWidth) / 2;
                startY = 0;
            }
            
            ctx.drawImage(video, startX, startY, drawWidth, drawHeight);
            ctx.drawImage(canvas, 0, 0);

            const link = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            link.download = `captura-ar-${timestamp}.png`;
            link.href = mergedCanvas.toDataURL('image/png');

            document.body.appendChild(link);
            link.click();
            document.body.appendChild(link);
            
            const button = document.getElementById('snap-button');
            const originalText = button.innerHTML;
            button.innerHTML = "¡Listo!";
            setTimeout(() => { button.innerHTML = originalText; }, 2000);

        } catch (e) {
            console.error("Error al tomar la captura:", e);
            alert("Hubo un problema al generar la imagen.");
        }
    }
});
