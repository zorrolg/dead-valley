// Inventory Display
define(['game', 'Inventory'], function (game, Inventory) {

  var draggingItem, draggingItemOriginalPos, draggingItemOriginalInv,
      currentDraggable, currentDraggableOffset;

  // magic numbers!
  // a single block is 44x44 but some extra crap is put in there
  var cellSize = 50;
  var itemOffset = {
    top:  3,
    left: 3
  };
  var doubleClickTimeout = 200; // in ms

  // dropping anywhere else reverts the drag
  $('body').droppable().bind('drop' ,function () {
    draggingItemOriginalInv.addItem(draggingItem,
                                    draggingItemOriginalPos.x,
                                    draggingItemOriginalPos.y);
    draggingItem = null;
    draggingItemOriginalPos = null;
    draggingItemOriginalInv = null;
  }).mousemove(function (e) {
    if (currentDraggable) {
      currentDraggable.css({
        left: e.pageX - currentDraggableOffset.left,
        top:  e.pageY - currentDraggableOffset.top
      });
    }
  }).click(function (e) {
    // if we currently have a draggable we need to pass clicks through
    if (currentDraggable) {
      currentDraggable.hide();

      // find the inteded target
      var target = $(document.elementFromPoint(e.pageX, e.pageY)).parents('.inventory');

      // re-show helper
      currentDraggable.show();

      // pass the click on to the intended target
      if (target.length) {
        target.trigger(e);
      }
    }
  });
 
  var clearCurrentDraggable = function () {
    if (currentDraggable) {
      currentDraggable.remove();
      currentDraggable = currentDraggableOffset = null;
    }
  };

  /** The InventoryDisplay Object **/

  var InventoryDisplay = function (inventory, parent, config) {
    this.inventory = inventory;
    this.parent    = parent;
    this.config    = config || {};

    this.clicks    = 0;

    this.createTable();

    this.renderAll();
    this.setupEventHandlers();
  };

  InventoryDisplay.prototype = {

    itemEventHandlers: {
      dragstart: function (event, ui) {
        var draggable = $(event.target);
        var item = draggable.data('item');
        this.dragStart(item);
      },
      click: function (event) {
        if (!currentDraggable) {
          this.clicks++;
          var self = this;
          if (this.clicks === 1) {
            setTimeout(function () {
              if (self.clicks === 1) {
                self.itemSingleClick(event);
              } else {
                self.itemDoubleClick(event);
              }
              self.clicks = 0;
            }, doubleClickTimeout);
          }
        }
        // so the table click handler doesn't fire
        event.stopPropagation();
      }
    },

    tableEventHandlers: {
      drop: function (e, ui) {
        var item;
        var tablePos = $(this.table).offset();
        var posX = Math.round((ui.offset.left - tablePos.left) / cellSize);
        var posY = Math.round((ui.offset.top - tablePos.top) / cellSize);

        // clear current draggable if we have one
        clearCurrentDraggable();

        if (this.inventory.isAvailable(draggingItem, posX, posY)) {
          // successful drag!

          // add the item to the inventory
          this.inventory.addItem(draggingItem, posX, posY);

          // remove the draggingItem data
          draggingItem = null;
          draggingItemOriginalPos = null;
          draggingItemOriginalInv = null;

        } else {

          // are we on top of a thing
          item = this.inventory.singleItemOverlay(draggingItem, posX, posY);

          if (item && item.acceptsDrop(draggingItem)) {
            // give it to the thing
            item.accept(draggingItem);

            // only restart the drag if there's something to drag after the drop
            if (draggingItem.viable()) {
              this.restartDrag(draggingItem, currentDraggableOffset);
            }
          } else if (item) {
            // swap em

            // save off the draggingItem, clickDragStart overwrites it
            var newItem = draggingItem;

            // start dragging the dropped on thing
            this.restartDrag(item);

            // add the dropped item to the inventory
            this.inventory.addItem(newItem, posX, posY);
          } else {
            // restart dragging the dropped thing
            this.restartDrag(draggingItem, currentDraggableOffset);
          }
        }
        // stop the drop event from bubbling to the body
        e.stopPropagation();
      },

      click: function (e) {
        // if we're click dragging something drop it on this table
        if (currentDraggable) {
          this.tableEventHandlers.drop.call(this, e, { offset: currentDraggable.offset() });
        }
      }
    },

    setupEventHandlers: function () {
      this.itemAddedEventHandler   = $.proxy(this.renderItem, this);
      this.itemRemovedEventHandler = $.proxy(this.removeItem, this);

      this.inventory.subscribe('itemAdded', this.itemAddedEventHandler);
      this.inventory.subscribe('itemRemoved', this.itemRemovedEventHandler);

      var self = this;
      _.each(this.tableEventHandlers, function (handler, key) {
        self.table.bind(key, $.proxy(handler, self));
      });
    },

    setupItemEventHandlers: function (itemNode) {
      var self = this;
      _.each(this.itemEventHandlers, function (handler, key) {
        itemNode.bind(key, $.proxy(handler, self));
      });
    },

    clearEventHandlers: function () {
      this.inventory.unsubscribe('itemAdded', this.itemAddedEventHandler);
      this.inventory.unsubscribe('itemRemoved', this.itemRemovedEventHandler);
    },

    // create the table markup
    createTable: function () {
      var i, j, row, td;
      var rowCount = this.inventory.height;
      var colCount = this.inventory.width;
      var table = $("<table/>").addClass("inventory");
      table.attr('id', this.config.id);
      for (i = 0; i < rowCount; i++) {
        row = $("<tr/>");
        for (j = 0; j < colCount; j++) {
          td = $("<td/>");
          row.append(td);
        }
        table.append(row);
      }

      table.droppable({
        greedy:    true,
        tolerance: 'touch'
      });

      this.parent.append(table);
      this.table = table;
    },

    // render an item at a place
    renderItem: function (item) {
      var i, j;
      var x = item.x;
      var y = item.y;
      var start = this.table.find("tr:eq("+y+") td:eq("+x+")");
      var pos = start.position();
      var displayNode = item.displayNode();
      displayNode.css({left:pos.left + itemOffset.left, top:pos.top + itemOffset.top});
      displayNode.addClass('inventory-item');
      displayNode.draggable({
        helper:      'clone',
        appendTo:    'body',
        containment: 'body',
        scroll:      false
      });
      displayNode.data('item', item);
      this.setupItemEventHandlers(displayNode);
      start.append(displayNode);
      for (i = 0; i < item.width; i++) {
        for (j = 0; j < item.height; j++) {
          this.table.find("tr:eq("+(y+j)+") td:eq("+(x+i)+")").addClass('occupied');
        }
      }
    },

    // remove the item from its place
    removeItem: function (item) {
      var x = item.x;
      var y = item.y;
      var start = this.table.find("tr:eq("+y+") td:eq("+x+")");
      start.empty();
      for (i = 0; i < item.width; i++) {
        for (j = 0; j < item.height; j++) {
          this.table.find("tr:eq("+(y+j)+") td:eq("+(x+i)+")").removeClass('occupied');
        }
      }
    },

    // render all the items in the associated Inventory
    renderAll: function () {
      _.each(this.inventory.items, function (item) {
        this.renderItem(item);
      }, this);
    },

    // this is run when we start the drag
    dragStart: function (item) {
      draggingItem = item;
      // remember the original position in case we need to abort
      draggingItemOriginalPos = {
        x: draggingItem.x,
        y: draggingItem.y
      };
      // also remember which inventory we came from
      draggingItemOriginalInv = this.inventory;
      // finally remove the draggable item from the inventory
      this.inventory.removeItem(draggingItem);
    },

    // this is run when we start the drag on a click
    clickDragStart: function (item, offset, event) {
      // create a 'helper' object to follow the mouse around
      currentDraggable = item.displayNode().clone();
      currentDraggable.addClass('inventory-item click-dragging');
      // keep track of the offset so we render the dragging correctly
      currentDraggableOffset = offset;

      // if we have an event, set the offset
      if (event) {
        currentDraggable.css({
          left: event.pageX - currentDraggableOffset.left,
          top:  event.pageY - currentDraggableOffset.top
        });
      }

      // finish the start of the drag as a draggable
      this.dragStart(item);

      $('body').append(currentDraggable);
    },

    restartDrag: function (item, offset) {
      // figure out the offset -- center it
      offset = offset || {
        left: (cellSize/2) * item.width,
        top:  (cellSize/2) * item.height
      };
      // restart dragging the dropped thing
      this.clickDragStart(item, offset);
    },

    // start a drag
    itemSingleClick: function (event) {
      var target = $(event.target).parentsUntil('td').andSelf().filter('.inventory-item');
      var pos = target.offset();
      this.clickDragStart(
        target.data('item'),
        {left:event.pageX - pos.left, top:event.pageY - pos.top},
        event
      );
    },

    // send the double clicked target to the configured inv
    itemDoubleClick: function (event) {
      var targetInventory = this.config.doubleClickTarget;
      if (targetInventory) {
        var target = $(event.target).parentsUntil('td').andSelf().filter('.inventory-item');
        var item = target.data('item');
        // save off the current coords
        var x = item.x;
        var y = item.y;
        this.inventory.removeItem(item);
        if (!targetInventory.stuffItemIn(item)) {
          // if it doesn't work out, add it back
          this.inventory.addItem(item, x, y);
        }
      }
    },

    toggle: function () {
      if (this.table.css('visibility') === 'hidden') {
        this.show();
      } else {
        this.hide();
      }
    },

    show: function () {
      this.table.css('visibility', 'visible');
    },

    hide: function () {
      this.table.css('visibility', 'hidden');
    },

    visible: function () {
      return this.table.css('visibility') === 'visible';
    }
  };

  return InventoryDisplay;
});
