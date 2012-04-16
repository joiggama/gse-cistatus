const St        = imports.gi.St;
const Main      = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Soup      = imports.gi.Soup;
const Mainloop  = imports.mainloop;
const Lang      = imports.lang;

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session   = new Soup.SessionAsync();

// Allow Session work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(Session, new Soup.ProxyResolverDefault());


const CI_URL = 'http://cruisecontrolrb.thoughtworks.com/XmlStatusReport.aspx';
const LOOP_INTERVAL = 60;

function CIStatusButton() {
  this._init()
}

CIStatusButton.prototype = {

  __proto__: PanelMenu.SystemStatusButton.prototype,

  _init: function() {
    PanelMenu.SystemStatusButton.prototype._init.call(this, 'cistatus-gray');
    this._iconActor.icon_type = St.IconType.FULLCOLOR;

  },

  _getCruiseControlReport: function() {
    if (typeof(self) != 'undefined') {
      self.menu.removeAll();
    }

    self = this;
    message = Soup.Message.new('GET', CI_URL);

    Session.queue_message(message, function() {
      if ((data = message.response_body.data) != null) {
        self._updateStatus(new XML(data));
      }
    });


    Mainloop.timeout_add_seconds(LOOP_INTERVAL, Lang.bind(this, this._getCruiseControlReport));
  },

  _newStatusIcon: function(iconName) {
    icon = new St.Icon({
      icon_name: iconName,
      icon_type: St.IconType.FULLCOLOR,
      icon_size: 16
    });
    return icon
  },

  _newMenuItem: function(itemName){
    item = new PopupMenu.PopupMenuItem(_(itemName));
    return item
  },

  _updateStatus: function(data) {

    for each(var project in data.Project) {
      projectName   = project.@name.toString();
      projectStatus = project.@lastBuildStatus.toString();

      switch(projectStatus) {
        case 'Success':
          iconName = 'cistatus-green';
          break;
        case 'Failure':
          iconName = 'cistatus-red';
          anyFailure = true;
          break;
        default:
          iconName = 'cistatus-gray';
      }

      menuItem = this._newMenuItem(projectName);
      menuItem.addActor(this._newStatusIcon(iconName));

      this.menu.addMenuItem(menuItem);
    }

    globalStatus = anyFailure == true ? 'cistatus-red' : 'cistatus-green';
    this._iconActor.icon_name = globalStatus;
  },

  enable: function() {
    Main.panel._rightBox.insert_actor(this.actor, 0);
    Main.panel._menus.addMenu(this.menu);

    this._mainloop = Mainloop.timeout_add(0, Lang.bind(this, function() {
      this._getCruiseControlReport();
    }));
  },

  disable: function() {
    Mainloop.source_remove(this._mainloop);
    Main.panel._menus.removeMenu(this.menu);
    Main.panel._rightBox.remove_actor(this.actor);
  }
}

function init() {
  return new CIStatusButton();
}
