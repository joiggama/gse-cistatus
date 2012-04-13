const St        = imports.gi.St;
const Main      = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;


const Soup = imports.gi.Soup;
const CI_URL = 'http://cruisecontrolrb.thoughtworks.com/XmlStatusReport.aspx';

function CIStatusButton() {
  this._init()
}

CIStatusButton.prototype = {

  __proto__: PanelMenu.SystemStatusButton.prototype,

  _init: function() {
    PanelMenu.SystemStatusButton.prototype._init.call(this, 'cistatus-gray');
    this._iconActor.icon_type = St.IconType.FULLCOLOR;

    this._getReport();
  },

  _getReport: function(){
    let that = this
    message = Soup.Message.new('GET', CI_URL);
    _httpSession = new Soup.SessionAsync();
    _httpSession.queue_message(message, function(){
      that._updateStatus(new XML(message.response_body.data));
    });
  },

  _updateStatus: function(data) {
    failure = null;
    for each(var project in data.Project) {
      menu_item = new PopupMenu.PopupMenuItem(_(project.@name.toString()));
      if (project.@lastBuildStatus == 'Success'){
        icon_name = 'cistatus-green';
      }
      else{
        icon_name = 'cistatus-red';
        failure = true;
      }

      icon_object = new St.Icon({ icon_name: icon_name, icon_type: St.IconType.FULLCOLOR, icon_size: 16 });
      menu_item.addActor(icon_object);

      this.menu.addMenuItem(menu_item);
    }
    this._iconActor.icon_name = (failure == true) ? 'cistatus-red' : 'cistatus-green';
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
