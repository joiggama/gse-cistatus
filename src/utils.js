const ExtUtils  = imports.ui.extensionSystem.ExtensionUtils;
const Extension = ExtUtils.getCurrentExtension();

const St        = imports.gi.St;
const Texture   = St.TextureCache.get_default();

function Icons() {
    return this._init();
};

Icons.prototype = {
    _init: function() {
        var iconsPath = 'file://' + Extension.path + '/icons/';

        return {
            get: function(iconName) {
                return Texture.load_uri_async(iconsPath + iconName, 16, 16);
            }
        }
    }
};
