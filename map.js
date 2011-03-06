// Map 

define(["game", "gridnode"], function (game, GridNode) {

  var Map = function (gridWidth, gridHeight, startX, startY, callback) {
    var i, j,
        imageData,
        startX,     startY,
        gridX,      gridY,
        imageWidth, imageHeight,
        offset,     nodeOffset,
        screenX,    screenY;

    var mapWorker = new Worker("mapworker.js");
    mapWorker.onerror = function (e) {
      console.log('worker error!', e);
    };

    this.init = function () {
      this.gridWidth  = gridWidth;
      this.gridHeight = gridHeight;
      this.width  = gridWidth * game.gridSize;
      this.height = gridHeight * game.gridSize;
      this.viewportGridWidth  = Math.ceil(game.canvasWidth / game.gridSize);
      this.viewportGridHeight = Math.ceil(game.canvasHeight / game.gridSize);

      // a map consists of 4 sections
      this.sectionWidth  = game.gridSize * gridWidth / 2;
      this.sectionHeight = game.gridSize * gridHeight / 2;

      this.shiftWestBorder = game.canvasWidth;
      this.shiftEastBorder = this.width - (2 * game.canvasWidth);
      this.shiftNorthBorder = game.canvasHeight;
      this.shiftSouthBorder = this.height - (2 * game.canvasHeight);

      // start in the center
      this.offsetX = game.gridSize * gridWidth/2  - gridWidth/2 + startX;
      this.offsetY = game.gridSize * gridHeight/2 - gridHeight/2 + startY;
      // world coordinates
      this.originOffsetX = -game.canvasWidth  / 2.0 + startX;
      this.originOffsetY = -game.canvasHeight / 2.0 + startY;

      this.velX = 0;
      this.velY = 0;

      this.nodes = new Array(gridWidth * gridHeight);
      this.freeNodes = [];

      this.levelMap = $('<canvas/>').attr({width:gridWidth, height:gridHeight});
      $('body').append(this.levelMap);

      this.levelMapContext = this.levelMap[0].getContext("2d");
      this.levelMapData = this.levelMapContext.createImageData(gridWidth, gridHeight);

      var mapData = this.levelMapData.data;
      for (i = 0; i < this.nodes.length; i++) {
        this.nodes[i] = new GridNode(this);
        j = i * 4;
        mapData[j]     = i & 255;
        mapData[j + 1] = (i >> 8) & 255;
        mapData[j + 2] = (i >> 16) & 255;
        mapData[j + 3] = 255; // has to be set
      }

      this.levelMapContext.putImageData(this.levelMapData, 0, 0);

      var node;

      // set up the positional references
      for (i = 0; i < this.gridWidth; i++) {
        for (j = 0; j < this.gridHeight; j++) {
          node       = this.getNode(i, j);
          node.north = this.getNode(i, j-1);
          node.south = this.getNode(i, j+1);
          node.west  = this.getNode(i-1, j);
          node.east  = this.getNode(i+1, j);

          // TODO don't do this here, should be in loadMapTiles
          node.setPosition(i * game.gridSize - this.offsetX + this.originOffsetX, j * game.gridSize - this.offsetY + this.originOffsetY);
        }
        node.transformedPoints();
      }

      this.loadStartMapTiles($.proxy(this.loaded, this));

      // test collidable tiles
      // var test = this.getNodeByWorldCoords(0, -140);
      // test.tileOffset = 6;
      // test.collidable = true;
    };

    this.getNodeByWorldCoords = function (x, y) {
      gridX = Math.floor((x - this.originOffsetX + this.offsetX) / game.gridSize);
      gridY = Math.floor((y - this.originOffsetY + this.offsetY) / game.gridSize);
      return this.getNode(gridX, gridY);
    };

    this.getNode = function (x, y) {
      if (x < 0 ||
          y < 0 ||
          x >= this.gridWidth ||
          y >= this.gridHeight) {
        return null;
      }
      return this.getNodeFromSection(x, y, this.levelMapData);
    };

    this.getNodeFromSection = function (x, y, section) {
      offset     = 4 * (y * section.width + x);
      nodeOffset = section.data[offset] +
                   (section.data[offset+1] << 8);
      return this.nodes[nodeOffset];
    };

    this.run = function (delta) {
      this.updatePosition(delta);
      this.shiftLevel();
    };

    this.updatePosition = function (delta) {
      this.offsetX += this.velX;
      this.offsetY += this.velY;
      this.originOffsetX += this.velX;
      this.originOffsetY += this.velY;
    };

    this.shiftLevel = function () {
      var chunks = this.getLevelChunks();

      if (this.offsetX < this.shiftWestBorder) {
        this.loadMapTiles(chunks.ne, 'nw');
        this.loadMapTiles(chunks.se, 'sw');
        this.swapVertical(chunks.nw, chunks.ne);
        this.swapVertical(chunks.sw, chunks.se);
        this.offsetX = this.offsetX + (this.width / 2);
      } else if (this.offsetX > this.shiftEastBorder) {
        this.loadMapTiles(chunks.nw, 'ne');
        this.loadMapTiles(chunks.sw, 'se');
        this.swapVertical(chunks.ne, chunks.nw);
        this.swapVertical(chunks.se, chunks.sw);
        this.offsetX = this.offsetX - (this.width / 2);
      }
      if (this.offsetY < this.shiftNorthBorder) {
        this.loadMapTiles(chunks.se, 'ne');
        this.loadMapTiles(chunks.sw, 'nw');
        this.swapHorizontal(chunks.ne, chunks.se);
        this.swapHorizontal(chunks.nw, chunks.sw);
        this.offsetY = this.offsetY + (this.height / 2);
      } else if (this.offsetY > this.shiftSouthBorder) {
        this.loadMapTiles(chunks.ne, 'se');
        this.loadMapTiles(chunks.nw, 'sw');
        this.swapHorizontal(chunks.se, chunks.ne);
        this.swapHorizontal(chunks.sw, chunks.nw);
        this.offsetY = this.offsetY - (this.height / 2);
      }
    };

    this.swapVertical = function (left, right) {
      var leftNode, rightNode, i;
      var leftX = left.width - 1;
      for (i = 0; i < left.height; i++) {
        leftNode  = this.getNodeFromSection(leftX, i, left);
        rightNode = this.getNodeFromSection(0, i, right);
        leftNode.east  = rightNode;
        rightNode.west = leftNode;
      }

      this.levelMapContext.putImageData(left, right.x, right.y);
      this.levelMapContext.putImageData(right, left.x, left.y);
    };

    this.swapHorizontal = function (top, bottom) {
      var upperNode, lowerNode, i;
      var bottomY = top.height - 1;
      for (i = 0; i < top.width; i++) {
        upperNode = this.getNodeFromSection(i, bottomY, top);
        lowerNode = this.getNodeFromSection(i, 0, bottom);
        upperNode.south = lowerNode;
        lowerNode.north = upperNode;
      }

      this.levelMapContext.putImageData(top, bottom.x, bottom.y);
      this.levelMapContext.putImageData(bottom, top.x, top.y);
    };

    // return an array of node objects from a part of the map
    this.getMapStrip = function (x, y, w, h) {
      var imageData = this.levelMapContext.getImageData(x, y, w, h);

      return this.convertToNodes(imageData.data);
    };

    // return an array of node objects from imageData
    this.convertToNodes = function (imageData) {
      var i, offset, nodeOffset;

      var nodes = [];

      i = imageData.length / 4;
      while (i) {
        i--;
        offset = i * 4;
        nodeOffset =  imageData[offset] +
                     (imageData[offset+1] << 8);

        nodes[i] = this.nodes[nodeOffset];
      }

      return nodes;
    };

    this.getSectionCoords = function (which) {
      switch(which) {
        case 'nw':
          return {x:-1, y:-1};
        case 'ne':
          return {x: 1, y:-1};
        case 'sw':
          return {x:-1, y: 1};
        case 'se':
          return {x: 1, y: 1};
      }
      // return {
      //   x: Math.ceil(world.x / this.sectionWidth),
      //   y: Math.ceil(world.y / this.sectionHeight)
      // };
    };

    this.loadMapTiles = function (imageData, position, section, callback) {
      var mapWidth  = imageData.width;
      var mapHeight = imageData.height;
      var mapData   = imageData.data;

      var newSection = this.convertToNodes(mapData);

      // TODO make it so we don't redefine this every time
      mapWorker.onmessage = function (e) {
        var data = JSON.parse(e.data);

        switch (data.type) {
          // so we can get output from the worker
          case 'log':
            console.log.apply(console, data.message);
            break;
          default:
            var newTiles = data.tiles;
            var i = newTiles.length;
            while (i) {
              i--;
              newSection[i].setFromString(newTiles[i]);
            }

            if (callback) {
              callback(newTiles);
            }
            break;
        }
      };
      
      var message = {
        width:  mapWidth,
        height: mapHeight,
        position: this.getSectionCoords(position),
        section: section
      };

      mapWorker.postMessage(JSON.stringify(message));
    };

    this.getLevelChunks = function () {
      var halfWidth  = this.gridWidth/2;
      var halfHeight = this.gridHeight/2;
      var chunks = {
        nw: this.levelMapContext.getImageData(0,
                                              0,
                                              halfWidth,
                                              halfHeight),
        sw: this.levelMapContext.getImageData(0,
                                              halfHeight,
                                              halfWidth,
                                              halfHeight),
        ne: this.levelMapContext.getImageData(halfWidth,
                                              0,
                                              halfWidth,
                                              halfHeight),
        se: this.levelMapContext.getImageData(halfWidth,
                                              halfHeight,
                                              halfWidth,
                                              halfHeight)
      };

      chunks.nw.x = 0;
      chunks.nw.y = 0;

      chunks.sw.x = 0;
      chunks.sw.y = halfHeight;

      chunks.ne.x = halfWidth;
      chunks.ne.y = 0;

      chunks.se.x = halfWidth;
      chunks.se.y = halfHeight;

      return chunks;
    };

    this.loadStartMapTiles = function (loadCallback) {
      var chunks = this.getLevelChunks();

      var self = this;
      self.loadMapTiles(chunks.nw, 'nw', 'intersection', function () {
        self.loadMapTiles(chunks.sw, 'sw', 'intersection', function () {
          self.loadMapTiles(chunks.ne, 'ne', 'intersection', function () {
            self.loadMapTiles(chunks.se, 'se', 'intersection', loadCallback);
          });
        });
      });
    };

    this.render = function (delta) {
      if (delta && !this.velX && !this.velY) {
        return;
      }

      startX = Math.floor(this.offsetX / game.gridSize) - 2;
      if (startX < 0) {
        startX = 0;
      }
      startY = Math.floor(this.offsetY / game.gridSize) - 2;
      if (startY < 0) {
        startY = 0;
      }
      imageWidth  = this.viewportGridWidth  + 4;
      imageHeight = this.viewportGridHeight + 4;

      imageData =
        this.levelMapContext.getImageData(startX,
                                          startY,
                                          imageWidth,
                                          imageHeight);
      imageWidth  = imageData.width;
      imageHeight = imageData.height;
      imageData   = imageData.data;

      i = imageData.length / 4;
      while (i) {
        i--;
        offset = i * 4;
        nodeOffset =  imageData[offset] +
                     (imageData[offset+1] << 8);
        gridX = ((i % imageWidth) + startX) * game.gridSize - this.offsetX;
        gridY = (Math.floor(i / imageWidth) + startY) * game.gridSize - this.offsetY;
        this.nodes[nodeOffset].render(delta, gridX, gridY);
      }
    };

    var hBorder = 300.0;
    var vBorder = 180.0;

    this.keepInView = function (sprite) {
      screenX = sprite.pos.x - this.originOffsetX;
      screenY = sprite.pos.y - this.originOffsetY;

      this.velX = 0;
      this.velY = 0;

      if (screenX < hBorder) {
        this.velX = screenX - hBorder;
      } else if (screenX > game.canvasWidth - hBorder) {
        this.velX = hBorder + screenX - game.canvasWidth;
      }
      if (screenY < vBorder) {
        this.velY = screenY - vBorder;
      } else if (screenY > game.canvasHeight - vBorder) {
        this.velY = vBorder + screenY - game.canvasHeight;
      }
    };

    this.loaded = function () {
      console.log('loaded');
      // run first render
      this.render(0);

      // fire the callback
      if (callback) {
        callback();
      }
    };

    this.init();
  };

  return Map;
});
