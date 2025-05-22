<?php
// edit.php — Visual CSV Level Editor w/ Sprite Preview
// Usage: edit.php?level=001

define('LEVEL_DIR', __DIR__ . '/');
$allowed = '/^[0-9]{3}$/';

// 1) get & validate level
$level = $_GET['level'] ?? '';
if (!preg_match($allowed, $level)) {
    die('❌ Invalid level');
}
$filename = LEVEL_DIR . "level_{$level}.csv";
if (!file_exists($filename)) {
    die("❌ File not found: level_{$level}.csv");
}

// 2) handle save
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['gridData'])) {
    // gridData is lines separated by "\n", each line a string of chars
    $csv = trim($_POST['gridData'], "\r\n") . "\n";
    file_put_contents($filename, $csv);
    header("Location: edit.php?level={$level}&saved=1");
    exit;
}

// 3) load CSV into PHP array of arrays of single chars
$lines = array_map('rtrim', file($filename));
$grid  = array_map(function($line){
    // split into single UTF-8 chars; default '#' for any missing
    $chars = preg_split('//u', rtrim($line), -1, PREG_SPLIT_NO_EMPTY);
    return array_map(fn($c) => $c === '' ? '#' : $c, $chars);
}, $lines);

// pass to JS
$grid_json = json_encode($grid);
$saved     = isset($_GET['saved']);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Edit Level <?php echo htmlspecialchars($level) ?></title>
  <style>
    body { font-family: sans-serif; padding: 1em; }
    #palette button {
      width: 40px; height: 40px; margin: .2em; padding: 0;
      border: 1px solid #aaa; background: #fff;
      display: inline-flex; align-items:center; justify-content:center;
    }
    #palette img { max-width: 100%; max-height: 100%; pointer-events: none; }
    #grid {
      display: grid; grid-gap: 1px; background: #888;
      margin-top: 1em; user-select: none;
    }
    #grid .cell {
      width: 32px; height: 32px; background: #fff;
      position: relative; cursor: pointer;
    }
    #grid .cell img {
      position: absolute; top:0; left:0;
      width:100%; height:100%; object-fit: contain;
      pointer-events: none;
    }
    #controls { margin-top: 1em; }
    #controls input { width: 4em; }
  </style>
</head>
<body>

  <h1>Editing Level <?php echo htmlspecialchars($level) ?></h1>
  <?php if ($saved): ?>
    <p style="color:green">✔ Level saved!</p>
  <?php endif ?>

  <div id="controls">
    Rows: <input type="number" id="in-rows" min="1" value=""><br>
    Cols: <input type="number" id="in-cols" min="1" value="">
    <button id="btn-resize">Resize Grid</button>
    <button id="btn-save">Save to CSV</button>
  </div>

  <div id="palette">
    Brush:
    <!-- air is now '#' -->
    <button data-char="#" title="Air"><img src="./../../assets/img/air.png"></button>
    <button data-char="G" title="Ground"><img src="./../../assets/img/block.png"></button>
    <button data-char="C" title="Coin"><img src="./../../assets/img/coin.gif"></button>
    <button data-char="S" title="Start"><img src="./../../assets/img/start.png"></button>
    <button data-char="F" title="Finish"><img src="./../../assets/img/finish.png"></button>
    <button data-char="J" title="Jump Pad"><img src="./../../assets/img/jumppad.png"></button>
    <button data-char="L" title="Lava"><img src="./../../assets/img/lava.png"></button>
    <label>Other: <input type="text" id="other-brush" maxlength="1" style="width:2em"></label> <!-- TODO -->
  </div>

  <div id="grid"></div>

  <form id="frm" method="post" style="display:none">
    <input type="hidden" name="gridData" id="gridData">
  </form>

  <script>
  (function(){
    // map each char to an image (or null for air '#')
    const tileMap = {
      '#':  './../../assets/img/air.png',
      'G':  './../../assets/img/block.png',
      'C':  './../../assets/img/coin.gif',
      'S':  './../../assets/img/start.png',
      'F':  './../../assets/img/finish.png',
      'J':  './../../assets/img/jumppad.png',
      'L':  './../../assets/img/lava.png',
      'X':  './../../assets/img/spike.png'
      // 'T':  './../../assets/img/teleport.png',
      // 'B':  './../../assets/img/box.png',
      // 'D':  './../../assets/img/door.png',
      // 'P':  './../../assets/img/portal.png',
      // 'E':  './../../assets/img/exit.png',
      // 'H':  './../../assets/img/heart.png',
      // 'M':  './../../assets/img/mob.png',
      // 'A':  './../../assets/img/arrow.png'
    };

    const rawGrid = <?php echo $grid_json ?>;
    let rows = rawGrid.length;
    let cols = rawGrid[0]?.length || 0;
    let brush = '#';           // default brush is air
    let isPainting = false;

    const gridEl     = document.getElementById('grid');
    const inRows     = document.getElementById('in-rows');
    const inCols     = document.getElementById('in-cols');
    const btnResize  = document.getElementById('btn-resize');
    const btnSave    = document.getElementById('btn-save');
    const palette    = document.getElementById('palette');
    const otherBrush = document.getElementById('other-brush');
    const frm        = document.getElementById('frm');
    const gridDataIn = document.getElementById('gridData');

    inRows.value = rows;
    inCols.value = cols;

    // build the grid from a 2D array of chars
    function buildGrid(data) {
      gridEl.innerHTML = '';
      rows = data.length;
      cols = data[0]?.length || 0;
      gridEl.style.gridTemplateColumns = `repeat(${cols},32px)`;
      gridEl.style.gridTemplateRows    = `repeat(${rows},32px)`;
      inRows.value = rows;
      inCols.value = cols;

      for (let r = 0; r < rows; ++r) {
        for (let c = 0; c < cols; ++c) {
          const ch = data[r][c] || '#';
          const cell = document.createElement('div');
          cell.className = 'cell';
          cell.dataset.r = r;
          cell.dataset.c = c;
          cell.dataset.char = ch;
          if (tileMap[ch]) {
            const img = document.createElement('img');
            img.src = tileMap[ch];
            cell.appendChild(img);
          }
          gridEl.appendChild(cell);
        }
      }
    }

    // paint one cell
    function paintCell(cell) {
      const ch = brush || '#';
      cell.dataset.char = ch;
      cell.innerHTML = '';
      if (tileMap[ch]) {
        const img = document.createElement('img');
        img.src = tileMap[ch];
        cell.appendChild(img);
      }
    }

    // painting handlers
    gridEl.addEventListener('mousedown', e => {
      const cell = e.target.closest('.cell');
      if (!cell) return;
      isPainting = true;
      paintCell(cell);
    });
    gridEl.addEventListener('mouseover', e => {
      if (!isPainting) return;
      const cell = e.target.closest('.cell');
      if (cell) paintCell(cell);
    });
    document.addEventListener('mouseup', () => {
      isPainting = false;
    });

    // select brush
    palette.addEventListener('click', e => {
      const btn = e.target.closest('button[data-char]');
      if (!btn) return;
      brush = btn.dataset.char;
      otherBrush.value = '';
    });
    otherBrush.addEventListener('input', e => {
      const v = e.target.value.trim().slice(0,1);
      if (v) brush = v;
    });

    // resize grid
    btnResize.addEventListener('click', () => {
      const r = parseInt(inRows.value, 10);
      const c = parseInt(inCols.value, 10);
      if (r > 0 && c > 0) {
        const newGrid = Array.from({length: r}, () => Array(c).fill('#'));
        buildGrid(newGrid);
      }
    });

    // save to CSV
    btnSave.addEventListener('click', () => {
      const cells = Array.from({length: rows}, () => []);
      document.querySelectorAll('#grid .cell').forEach(div => {
        const r = +div.dataset.r, c = +div.dataset.c;
        // every cell.dataset.char is now '#' or a tile
        cells[r][c] = div.dataset.char || '#';
      });
      const lines = cells.map(row => row.join(''));
      gridDataIn.value = lines.join("\n");
      frm.submit();
    });

    // initialize
    buildGrid(rawGrid);
  })();
  </script>

</body>
</html>
