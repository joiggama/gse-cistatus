const St      = imports.gi.St;
const Texture = St.TextureCache.get_default();

function Loader(path) {
  this._init(path);
};

Loader.prototype = {
  _init: function (path) {
    this._iconsPath = 'file://' + path + '/icons/';
  },

  // Declare icon getter
  get: function(iconName) {
    let iconUri = this._iconsPath + iconName + '.png';
    return Texture.load_uri_async(iconUri, 16, 16);
  }
};
