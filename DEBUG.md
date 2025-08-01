# 偵錯日誌 (Debug Log)

本文件記錄了在開發 `Image Cropper` 過程中遇到的主要問題、錯誤的修復嘗試，以及最終的解決方案。

---

### 問題 1：`Uncaught TypeError: Cannot read properties of null (reading 'width')`

- **現象**：在尚未載入任何圖片的情況下，若使用者點擊「旋轉」按鈕或在畫布上進行任何操作，主控台會拋出此錯誤。
- **根本原因**：`drawImage()` 或 `redraw()` 等函式在 `this.image` 物件仍然是 `null` 的時候被呼叫，導致試圖讀取一個 `null` 物件的 `width` 屬性而發生錯誤。
- **解決方案**：在 `redraw()`、`drawImage()` 和 `rotate()` 函式的開頭，加入一個防呆的保護機制 `if (!this.image) return;`。這可以確保在圖片成功載入之前，任何與繪圖相關的程式碼都不會被執行，從而避免了此錯誤。

---

### 問題 2：無法正常建立裁切框

- **現象**：使用者在畫布上點擊並拖曳以建立新的裁切框時，裁切框無法被正常拉大，而是會被「強制縮小」或「卡」在滑鼠點擊的初始點。
- **根本原因**：在處理滑鼠移動的 `onActionMove` 函式中，程式碼在每次滑鼠移動後都更新了 `this.dragStart` 的位置。這導致在 `drawing`（繪製）模式下，裁切框的寬高是相對於「前一個點」而不是「最初的點」來計算的，因此無法正確擴大。
- **解決方案**：將 `this.dragStart = pos;` 這行程式碼從 `onActionMove` 的通用區域，移動到 `dragging`（拖曳）和 `resizing`（縮放）的條件判斷式內部。這樣可以確保只有在移動或縮放現有裁切框時才更新起始點，而在建立新裁切框時，起始點會保持固定不變。

---

### 問題 3：圖片旋轉後，輸出的裁切座標不正確

- **現象**：當圖片旋轉 90 度後，輸出的裁切參數（特別是 `x` 和 `y` 座標）與未旋轉時相同，導致後端裁切出來的結果與預期不符。
- **錯誤的修復嘗試**：我最初的嘗試是進行複雜的「逆向旋轉」幾何運算，試圖將旋轉後裁切框的座標還原回「未旋轉」的原始圖片座標系。這個方向是錯誤的，因為後端 ImageMagick 在執行 `-rotate` 指令後，是期望得到相對於「已經旋轉完成」的圖片的座標。
- **根本原因與正確的解決方案**：問題的核心在於對後端需求的理解。正確的邏輯應該是提供裁切框在**當前視覺狀態**下的相對座標。解決方案是重寫 `getCropData` 函式，採用更直接的邏輯：
    1.  取得裁切框在畫布上的 `x, y` 座標。
    2.  計算出**旋轉後**的圖片在畫布上的可見邊界 (`getImageBoundingBox`)。
    3.  用裁切框的 `x, y` 減去圖片邊界的 `x, y`，得到裁切框相對於**旋轉後圖片左上角**的相對座標。
    4.  最後，將這個相對座標和裁切框的寬高，從畫布的縮放尺寸等比例放大回原始圖片的完整尺寸。這個方法確保了輸出的裁切參數與使用者在畫面上看到的結果完全一致，並且是後端 ImageMagick 所需要的正確格式。

---

### 問題 4：建立裁切框時，拖曳方向與繪製結果不一致

- **現象**：當使用者向右上方拖曳（x 軸增加，y 軸減少）時，裁切框卻向右下方繪製（x, y 軸皆增加）。
- **根本原因**：在 `onActionMove` 函式的繪製邏輯中，當計算長寬比時，程式碼錯誤地將 `y` 軸的負值（向上）轉換為正值（向下），導致方向錯誤。
- **解決方案**：重寫繪製邏輯。新的程式碼會先計算 `x` 和 `y` 方向的絕對移動距離，根據長寬比調整其中一個軸的絕對距離，最後使用 `Math.sign()` 將正確的「方向」（正或負）重新應用到計算好的寬和高上，確保繪製方向與使用者拖曳的方向一致。

---

### 問題 5：邊界修正功能未保持長寬比

- **現象**：當裁切框超出圖片邊界時，`onActionEnd` 中的自動修正功能雖然能將裁切框拉回邊界內，但會破壞使用者設定好的長寬比。
- **根本原因**：初版的邊界修正邏輯是獨立地修正裁切框的四個邊，沒有考慮到它們之間的比例關係。
- **解決方案**：重寫 `onActionEnd` 函式。新的邏輯會先判斷是否設定了 `aspectRatio`。如果設定了比例，程式會優先透過等比例縮小整個裁切框來使其符合邊界，然後再修正其位置，從而確保在修正過程中，長寬比始終保持不變。
