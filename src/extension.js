const Lang      = imports.lang;
const Main      = imports.ui.main;
const Mainloop  = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Soup      = imports.gi.Soup;
const St        = imports.gi.St;

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session   = new Soup.SessionAsync();

// Allow Session work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(
  Session, new Soup.ProxyResolverDefault()
);


const CI_URL = 'http://cruisecontrolrb.thoughtworks.com/XmlStatusReport.aspx';
const LOOP_INTERVAL = 60;

function Indicator(metadata) {
  this._init(metadata)
}

Indicator.prototype = {

  __proto__: PanelMenu.SystemStatusButton.prototype,

  _init: function(metadata) {
    PanelMenu.SystemStatusButton.prototype._init.call(this, 'cistatus-gray');
    this._iconActor.icon_type = St.IconType.FULLCOLOR;
  },

  _getCruiseControlReport: function() {
    if (this.menu.numMenuItems > 0) {
      this.menu.removeAll();
    }

    let self = this;
    let message = Soup.Message.new('GET', CI_URL);

    Session.queue_message(message, function() {
      let data = message.response_body.data;
      if (data != null) {
        self._updateStatus(new XML(data));
      }
    });


    Mainloop.timeout_add_seconds(
      LOOP_INTERVAL,
      Lang.bind(this, this._getCruiseControlReport)
    );
  },

  _newStatusIcon: function(iconName) {
    return new St.Icon({
      icon_name: iconName,
      icon_type: St.IconType.FULLCOLOR,
      icon_size: 16
    })
  },

  _newMenuItem: function(itemName){
    return new PopupMenu.PopupMenuItem(_(itemName))
  },

  _updateStatus: function(data) {

    let anyFailure;

    for each(var project in data.Project) {
      let projectName   = project.@name.toString();
      let projectStatus = project.@lastBuildStatus.toString();
      let projectUrl    = project.@webUrl.toString();

      let iconName;

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

      let menuItem = this._newMenuItem(projectName);
      menuItem.addActor(this._newStatusIcon(iconName));

      this.menu.addMenuItem(menuItem);
    }

    let globalStatus = anyFailure == true ? 'cistatus-red' : 'cistatus-green';
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

function init(metadata) {
  return new Indicator(metadata)
}
