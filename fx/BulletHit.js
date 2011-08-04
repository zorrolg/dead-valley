
define(['game', 'Sprite'], function (game, Sprite) {

  var context = game.spriteContext;

  var defaultConfig = {
    color:     'white',
    minLength: -5,
    range:     -10,
    lifetime:  0.2,
    size:      1
  };

  var Sparks = function (result, config) {
    this.pos     = result.point;
    this.pos.rot = 0;
    this.life    = 0;

    var norm     = result.normal;
    var dir      = result.direction;
    // generates a reflection about the normal
    var reflect  = norm.multiply(2 * dir.dotProduct(norm) / norm.dotProduct(norm)).subtract(dir);

    // allow overrides
    $.extend(this, config);

    this.sparks = this.createSparks(norm, dir, reflect, config);

    _.each(this.sparks, function (spark) {
      spark.life = config.lifetime - config.lifetime * Math.random();
    });
  };
  Sparks.prototype = new Sprite();

  Sparks.prototype.createSparks = function (norm, dir, reflect, config) {
    return [
      norm.multiply(this.minLength    + Math.random() * this.range),
      dir.multiply(this.minLength     + Math.random() * this.range),
      reflect.multiply(this.minLength + Math.random() * this.range)
    ];
  };

  Sparks.prototype.postMove = function (delta) {
    this.life += delta;
    if (this.life > this.lifetime) {
      this.die();
    }
  };

  Sparks.prototype.draw = function (delta) {
    // context.fillStyle = this.color;
    // var size = this.size;
    // var life = this.life;
    // var percent = life / this.lifetime;
    // var pos;
    // _.each(this.sparks, function (spark) {
    //   if (life < spark.life) {
    //     pos = spark.multiply(percent);
    //     context.fillRect(pos.x, pos.y, size, size);
    //   }
    // });
  };

  // don't need these methods
  Sparks.prototype.move             = function () {};
  Sparks.prototype.transformNormals = function () {};
  Sparks.prototype.updateGrid       = function () {};

  var BulletHit = function (config) {
    this.config = $.extend({}, defaultConfig, config);
  };

  BulletHit.prototype.fireSparks = function (result) {
    // TODO reenable when we know a way to do this
    // game.sprites.push(new Sparks(result, this.config));
  };

  return BulletHit;
});
