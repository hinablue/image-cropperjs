class ImageCropper {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.options = { ...{
            width: this.canvas.getBoundingClientRect().width,
            height: this.canvas.getBoundingClientRect().height,
            aspectRatio: null
        }, ...options };

        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;

        this.image = null;
        this.rotation = 0;
        this.scale = 1;
        this.imageOffset = { x: 0, y: 0 };

        this.cropBox = null;
        this.action = 'none';
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandleSize = 10; // Slightly larger for touch
        this.selectedHandle = null;

        this.init();
    }

    init() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', this.onActionStart.bind(this));
        this.canvas.addEventListener('mousemove', this.onActionMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onActionEnd.bind(this));
        this.canvas.addEventListener('mouseout', this.onActionEnd.bind(this));

        // Touch Events
        this.canvas.addEventListener('touchstart', this.onActionStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onActionMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onActionEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.onActionEnd.bind(this));
    }

    loadImage(imageSrc) {
        this.image = new Image();
        this.image.onload = () => {
            this.rotation = 0;
            this.updateCanvas(); // Set scale and draw image first
            this._setDefaultCropBox(); // Then create the default box
            this.redraw(); // Redraw to show the new box
        };
        this.image.src = imageSrc;
    }

    _setDefaultCropBox() {
        if (!this.image) return;

        const bounds = this.getImageBoundingBox();
        const ar = this.options.aspectRatio;
        let width, height;

        // Determine the size of the default crop box (e.g., 80% of the smaller dimension)
        const targetWidth = bounds.width * 0.8;
        const targetHeight = bounds.height * 0.8;

        if (ar) {
            if (targetWidth / ar <= targetHeight) {
                width = targetWidth;
                height = width / ar;
            } else {
                height = targetHeight;
                width = height * ar;
            }
        } else {
            const size = Math.min(targetWidth, targetHeight);
            width = size;
            height = size;
        }

        // Center the box
        const x = bounds.x + (bounds.width - width) / 2;
        const y = bounds.y + (bounds.height - height) / 2;

        this.cropBox = { x, y, width, height };
    }

    updateCanvas() {
        if (!this.image) return;
        this.scale = Math.min(this.canvas.width / this.image.width, this.canvas.height / this.image.height);
        const scaledWidth = this.image.width * this.scale;
        const scaledHeight = this.image.height * this.scale;
        this.imageOffset.x = (this.canvas.width - scaledWidth) / 2;
        this.imageOffset.y = (this.canvas.height - scaledHeight) / 2;
        this.redraw();
    }

    redraw() {
        if (!this.image) return; // Prevent drawing if no image is loaded
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawImage();
        if (this.cropBox) {
            this.drawCropBox();
        }
    }

    drawImage() {
        if (!this.image) return; // Prevent drawing if no image is loaded
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate(this.rotation * Math.PI / 180);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        this.ctx.drawImage(this.image, this.imageOffset.x, this.imageOffset.y, this.image.width * this.scale, this.image.height * this.scale);
        this.ctx.restore();
    }

    rotate() {
        if (!this.image) return; // Prevent rotating if no image is loaded
        if (this.cropBox) {
            const center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            const cropCenter = { x: this.cropBox.x + this.cropBox.width / 2, y: this.cropBox.y + this.cropBox.height / 2 };
            const translated = { x: cropCenter.x - center.x, y: cropCenter.y - center.y };
            const rotated = { x: -translated.y, y: translated.x };
            const newCropCenter = { x: rotated.x + center.x, y: rotated.y + center.y };
            const newWidth = this.cropBox.height;
            const newHeight = this.cropBox.width;
            this.cropBox = { x: newCropCenter.x - newWidth / 2, y: newCropCenter.y - newHeight / 2, width: newWidth, height: newHeight };
        }
        this.rotation = (this.rotation + 90) % 360;
        this.redraw();
    }

    getImageBoundingBox() {
        if (!this.image) return { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height };
        const w = this.image.width * this.scale;
        const h = this.image.height * this.scale;
        const x = this.imageOffset.x;
        const y = this.imageOffset.y;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const angle = this.rotation * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const corners = [{ x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }];
        const rotatedCorners = corners.map(p => {
            const translatedX = p.x - cx;
            const translatedY = p.y - cy;
            return { x: translatedX * cos - translatedY * sin + cx, y: translatedX * sin + translatedY * cos + cy };
        });
        const minX = Math.min(...rotatedCorners.map(p => p.x));
        const minY = Math.min(...rotatedCorners.map(p => p.y));
        const maxX = Math.max(...rotatedCorners.map(p => p.x));
        const maxY = Math.max(...rotatedCorners.map(p => p.y));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    onActionStart(e) {
        e.preventDefault();
        const pos = this.getEventPos(e);
        const bounds = this.getImageBoundingBox();
        if (pos.x < bounds.x || pos.x > bounds.x + bounds.width || pos.y < bounds.y || pos.y > bounds.y + bounds.height) return;

        this.selectedHandle = this.cropBox ? this.getHandleForMousePos(pos) : null;
        if (this.selectedHandle) {
            this.action = 'resizing';
        } else if (this.cropBox && this.isWithinCropBox(pos)) {
            this.action = 'dragging';
        } else {
            this.action = 'drawing';
            this.cropBox = { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        this.dragStart = pos;
    }

    onActionMove(e) {
        e.preventDefault();
        if (this.action === 'none') {
            this.updateCursor(this.getEventPos(e));
            return;
        }

        const pos = this.getEventPos(e);
        const bounds = this.getImageBoundingBox();

        if (this.action === 'drawing') {
            const clampedPos = {
                x: Math.max(bounds.x, Math.min(pos.x, bounds.x + bounds.width)),
                y: Math.max(bounds.y, Math.min(pos.y, bounds.y + bounds.height))
            };
            const dx = clampedPos.x - this.dragStart.x;
            const dy = clampedPos.y - this.dragStart.y;

            if (this.options.aspectRatio) {
                const ar = this.options.aspectRatio;
                let abs_dx = Math.abs(dx);
                let abs_dy = Math.abs(dy);

                if (abs_dx > abs_dy * ar) {
                    abs_dy = abs_dx / ar;
                } else {
                    abs_dx = abs_dy * ar;
                }
                
                this.cropBox.width = abs_dx * Math.sign(dx);
                this.cropBox.height = abs_dy * Math.sign(dy);
            } else {
                this.cropBox.width = dx;
                this.cropBox.height = dy;
            }
        } else if (this.action === 'dragging') {
            const dx = pos.x - this.dragStart.x;
            const dy = pos.y - this.dragStart.y;
            this.cropBox.x = Math.max(bounds.x, Math.min(this.cropBox.x + dx, bounds.x + bounds.width - this.cropBox.width));
            this.cropBox.y = Math.max(bounds.y, Math.min(this.cropBox.y + dy, bounds.y + bounds.height - this.cropBox.height));
            this.dragStart = pos;
        } else if (this.action === 'resizing') {
            const clampedPos = {
                x: Math.max(bounds.x, Math.min(pos.x, bounds.x + bounds.width)),
                y: Math.max(bounds.y, Math.min(pos.y, bounds.y + bounds.height))
            };
            const dx = clampedPos.x - this.dragStart.x;
            const dy = clampedPos.y - this.dragStart.y;
            this.resizeCropBox(dx, dy);
            this.dragStart = clampedPos; // Use clamped position for next iteration
        }

        this.redraw();
    }

    onActionEnd(e) {
        e.preventDefault();

        if (!this.cropBox) {
            this.action = 'none';
            return;
        }

        // First, normalize the box if it was drawn in a negative direction
        if (this.action === 'drawing') {
            if (this.cropBox.width < 0) {
                this.cropBox.x += this.cropBox.width;
                this.cropBox.width *= -1;
            }
            if (this.cropBox.height < 0) {
                this.cropBox.y += this.cropBox.height;
                this.cropBox.height *= -1;
            }
        }

        // After any action, clamp the crop box to the image boundaries
        const bounds = this.getImageBoundingBox();
        let { x, y, width, height } = this.cropBox;

        if (this.options.aspectRatio) {
            const ar = this.options.aspectRatio;

            // 1. Clamp size while maintaining aspect ratio
            if (width > bounds.width) {
                width = bounds.width;
                height = width / ar;
            }
            if (height > bounds.height) {
                height = bounds.height;
                width = height * ar;
            }

            // 2. Clamp position
            if (x < bounds.x) x = bounds.x;
            if (y < bounds.y) y = bounds.y;
            if (x + width > bounds.x + bounds.width) x = bounds.x + bounds.width - width;
            if (y + height > bounds.y + bounds.height) y = bounds.y + bounds.height - height;

        } else {
            // Freeform clamping
            const newX = Math.max(x, bounds.x);
            const newY = Math.max(y, bounds.y);
            const newMaxX = Math.min(x + width, bounds.x + bounds.width);
            const newMaxY = Math.min(y + height, bounds.y + bounds.height);

            x = newX;
            y = newY;
            width = newMaxX - newX;
            height = newMaxY - newY;
        }

        this.cropBox = { x, y, width, height };
        this.action = 'none';
        this.selectedHandle = null;
        this.redraw();
    }

    resizeCropBox(dx, dy) {
        let { x, y, width, height } = this.cropBox;
        const handle = this.selectedHandle;

        if (this.options.aspectRatio) {
            const ar = this.options.aspectRatio;
            let growth = 0;

            // Determine the growth factor based on the handle and mouse movement
            if (handle === 'tr') {
                growth = (dx - dy) / 2;
            } else if (handle === 'bl') {
                growth = (dy - dx) / 2;
            } else if (handle === 'tl') {
                growth = (-dx - dy) / 2;
            } else { // br
                growth = (dx + dy) / 2;
            }

            const widthChange = growth;
            const heightChange = growth / ar;

            width += widthChange;
            height += heightChange;

            if (handle.includes('l')) {
                x -= widthChange;
            }
            if (handle.includes('t')) {
                y -= heightChange;
            }

        } else {
            // Freeform logic (remains the same)
            if (handle.includes('l')) { width -= dx; x += dx; }
            if (handle.includes('r')) { width += dx; }
            if (handle.includes('t')) { height -= dy; y += dy; }
            if (handle.includes('b')) { height += dy; }
        }

        this.cropBox = { x, y, width, height };
    }

    drawCropBox() {
        const { x, y, width, height } = this.cropBox;

        // Fill the crop box with a semi-transparent color
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; // Semi-transparent white
        this.ctx.fillRect(x, y, width, height);

        // Draw the border
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Draw the resize handles
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        const handleSize = this.resizeHandleSize;
        const halfHandle = handleSize / 2;
        Object.values(this.getHandles()).forEach(pos => {
            this.ctx.fillRect(pos.x - halfHandle, pos.y - halfHandle, handleSize, handleSize);
        });
    }

    getHandles() {
        if (!this.cropBox) return {};
        const { x, y, width, height } = this.cropBox;
        const handles = { 'tl': { x: x, y: y }, 'tr': { x: x + width, y: y }, 'bl': { x: x, y: y + height }, 'br': { x: x + width, y: y + height } };
        if (!this.options.aspectRatio) {
            Object.assign(handles, { 't': { x: x + width / 2, y: y }, 'b': { x: x + width / 2, y: y + height }, 'l': { x: x, y: y + height / 2 }, 'r': { x: x + width, y: y + height / 2 } });
        }
        return handles;
    }

    getHandleForMousePos(pos) {
        const handles = this.getHandles();
        const threshold = this.resizeHandleSize;
        for (const name in handles) {
            if (Math.abs(pos.x - handles[name].x) <= threshold && Math.abs(pos.y - handles[name].y) <= threshold) return name;
        }
        return null;
    }

    isWithinCropBox(pos) {
        return this.cropBox && (pos.x >= this.cropBox.x && pos.x <= this.cropBox.x + this.cropBox.width && pos.y >= this.cropBox.y && pos.y <= this.cropBox.y + this.cropBox.height);
    }

    updateCursor(pos) {
        const handle = this.cropBox ? this.getHandleForMousePos(pos) : null;
        if (handle) {
            if (handle === 'tl' || handle === 'br') this.canvas.style.cursor = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') this.canvas.style.cursor = 'nesw-resize';
            else if (handle === 't' || handle === 'b') this.canvas.style.cursor = 'ns-resize';
            else this.canvas.style.cursor = 'ew-resize';
        } else if (this.isWithinCropBox(pos)) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    getCropData() {
        if (!this.cropBox || this.cropBox.width <= 0 || this.cropBox.height <= 0) return null;

        // The backend needs crop coordinates relative to the *rotated* image.
        // The visual crop box on the canvas is already what the user wants.
        // We just need to calculate its position relative to the rotated image's top-left corner on the canvas and scale it up.

        const rotatedImageBounds = this.getImageBoundingBox();

        // The cropBox x,y is relative to the canvas's top-left.
        // We need it to be relative to the rotated image's top-left on the canvas.
        const relativeX = this.cropBox.x - rotatedImageBounds.x;
        const relativeY = this.cropBox.y - rotatedImageBounds.y;

        // Scale up the relative coordinates and the crop box dimensions.
        const finalX = relativeX / this.scale;
        const finalY = relativeY / this.scale;
        const finalWidth = this.cropBox.width / this.scale;
        const finalHeight = this.cropBox.height / this.scale;

        // The `originalImage` dimensions in the output should also reflect the rotation for clarity.
        const isSwapped = (this.rotation / 90) % 2 !== 0;

        return {
            originalImage: {
                width: isSwapped ? this.image.height : this.image.width,
                height: isSwapped ? this.image.width : this.image.height
            },
            cropInfo: {
                x: Math.round(finalX),
                y: Math.round(finalY),
                width: Math.round(finalWidth),
                height: Math.round(finalHeight),
                rotate: this.rotation
            }
        };
    }

    getCroppedCanvasDataURL(options = {}) {
        if (!this.image || !this.cropBox || this.cropBox.width <= 0 || this.cropBox.height <= 0) {
            console.error("Cannot export: Image not loaded or no crop box defined.");
            return null;
        }

        const type = options.type || 'image/jpeg';
        const quality = options.quality || 0.92;

        const cropData = this.getCropData();
        if (!cropData) return null;

        const { x, y, width, height, rotate } = cropData.cropInfo;

        // Create an offscreen canvas to draw the rotated original image
        const offscreenCanvas = document.createElement('canvas');
        const offscreenCtx = offscreenCanvas.getContext('2d');

        const isSwapped = (rotate / 90) % 2 !== 0;
        const rotatedOriginalWidth = isSwapped ? this.image.height : this.image.width;
        const rotatedOriginalHeight = isSwapped ? this.image.width : this.image.height;

        offscreenCanvas.width = rotatedOriginalWidth;
        offscreenCanvas.height = rotatedOriginalHeight;

        // Rotate the offscreen canvas and draw the original image
        offscreenCtx.translate(rotatedOriginalWidth / 2, rotatedOriginalHeight / 2);
        offscreenCtx.rotate(rotate * Math.PI / 180);
        offscreenCtx.drawImage(this.image, -this.image.width / 2, -this.image.height / 2);

        // Create the final canvas with the exact crop dimensions
        const finalCanvas = document.createElement('canvas');
        const finalCtx = finalCanvas.getContext('2d');
        finalCanvas.width = width;
        finalCanvas.height = height;

        // Clip the desired area from the offscreen canvas to the final canvas
        finalCtx.drawImage(
            offscreenCanvas,
            x, y,       // Source x, y
            width, height, // Source width, height
            0, 0,        // Destination x, y
            width, height  // Destination width, height
        );

        return finalCanvas.toDataURL(type, quality);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cropper = new ImageCropper('imageCanvas', {
        aspectRatio: 1 / 1
    });

    const imageLoader = document.getElementById('imageLoader');
    imageLoader.addEventListener('change', (e) => {
        const reader = new FileReader();
        reader.onload = (event) => { cropper.loadImage(event.target.result); }
        reader.readAsDataURL(e.target.files[0]);
    });

    const rotateBtn = document.getElementById('rotateBtn');
    rotateBtn.addEventListener('click', () => { cropper.rotate(); });

    const cropBtn = document.getElementById('cropBtn');
    const output = document.getElementById('output');
    cropBtn.addEventListener('click', () => {
        const data = cropper.getCropData();
        if (data) {
            output.textContent = 'Sending data to server...';
            fetch('index.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP error! status: ${response.status}`)))
            .then(result => { output.textContent = JSON.stringify(result, null, 2); })
            .catch(error => {
                console.error('Error:', error);
                output.textContent = `Error sending data to server: ${error.message}. See console for details.`;
            });
        } else {
            output.textContent = 'Please select a crop area.';
        }
    });

    const exportBtn = document.getElementById('exportBtn');
    exportBtn.addEventListener('click', () => {
        const dataUrl = cropper.getCroppedCanvasDataURL({ type: 'image/jpeg', quality: 0.9 });
        if (dataUrl) {
            const exportedImage = document.getElementById('exportedImage');
            exportedImage.src = dataUrl;
            exportedImage.style.display = 'block';
        }
    });
});