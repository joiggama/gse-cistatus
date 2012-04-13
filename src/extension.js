const St = imports.gi.St;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;


let menuItem;

function CIStatusButton() {
  this._init()
}

CIStatusButton.prototype = {

  __proto__: PanelMenu.SystemStatusButton.prototype,

  _init: function() {
    PanelMenu.SystemStatusButton.prototype._init.call(this, 'cistatus-gray');

    this._iconActor.icon_type = St.IconType.FULLCOLOR;

    menuItem = new PopupMenu.PopupMenuItem(_("Settings"));
    this.menu.addMenuItem(menuItem);
  },

  enable: function() {
    Main.panel._rightBox.insert_actor(this.actor, 0);
    Main.panel._menus.addMenu(this.menu);
  },

  disable: function() {
    Main.panel._menus.removeMenu(this.menu);
    Main.panel._rightBox.remove_actor(this.actor);
  }
}

function init() {
  return new CIStatusButton();
}
