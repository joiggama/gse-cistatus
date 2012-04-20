const GLib      = imports.gi.GLib;
const Lang      = imports.lang;
const Main      = imports.ui.main;
const Mainloop  = imports.mainloop;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Signals   = imports.signals;
const Soup      = imports.gi.Soup;
const St        = imports.gi.St;

// Prevent Session from being garbage collected http://goo.gl/KKCYe
const Session   = new Soup.SessionAsync();

// Allow Session work under a proxy http://goo.gl/KKCYe
Soup.Session.prototype.add_feature.call(
  Session, new Soup.ProxyResolverDefault()
);

const Texture   = St.TextureCache.get_default();

const CI_URL = 'http://cruisecontrolrb.thoughtworks.com/XmlStatusReport.aspx';
const LOOP_INTERVAL = 60;

function Indicator(metadata) {
  this._init(metadata)
}

Indicator.prototype = {

  __proto__: PanelMenu.ButtonBox.prototype,

  _init: function(metadata) {

    PanelMenu.ButtonBox.prototype._init.call(this, {
      reactive: true,
      can_focus: true,
      track_hover: true
    });

    this._path = metadata.path;
    this.actor.add_actor(this._newStatusIcon('cistatus-gray'));

    this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));

    this.leftMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    Main.uiGroup.add_actor(this.leftMenu.actor);
    this.leftMenu.actor.hide();

    this.rightMenu = new PopupMenu.PopupMenu(this.actor, 0.0, St.Side.TOP);
    Main.uiGroup.add_actor(this.rightMenu.actor);
    this.rightMenu.actor.hide();

  },

  _onButtonPress: function(actor, event) {
      switch(event.get_button()){
        case 1 :
          // left button
          this.rightMenu.isOpen ? this.rightMenu.close() : undefined;
          this.leftMenu.toggle();
          break;
        case 3 :
          // right button
          this.leftMenu.isOpen ? this.leftMenu.close(): undefined;
          this.rightMenu.toggle();
          break;
        default:
          // any other button
          break;
      }
  },


  _getCruiseControlReport: function() {
    if (this.leftMenu.numMenuItems > 0) {
      this.leftMenu.removeAll();
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
    let icon_uri = 'file://' + this._path + '/icons/' + iconName +'.png';
    return Texture.load_uri_async(icon_uri, 16, 16)
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

      menuItem.actor.connect('button-press-event', Lang.bind(this, function(){
        this._visitProjectUrl(projectUrl);
      }));

      this.leftMenu.addMenuItem(menuItem);
    }

    let globalStatus = anyFailure == true ? 'cistatus-red' : 'cistatus-green';
    this.actor.destroy_children();
    this.actor.add_actor(this._newStatusIcon(globalStatus));
  },

  _visitProjectUrl: function(projectUrl) {
    GLib.spawn_async_with_pipes(
      null,
      ["gnome-www-browser","-m", projectUrl],
      null,
      GLib.SpawnFlags.SEARCH_PATH,
      null
    );
  },

  enable: function() {
    Main.panel._rightBox.insert_actor(this.actor, 0);
    Main.panel._menus.addMenu(this.rightMenu);
    Main.panel._menus.addMenu(this.leftMenu);

    this._mainloop = Mainloop.timeout_add(0, Lang.bind(this, function() {
      this._getCruiseControlReport();
    }));
  },

  disable: function() {
    Mainloop.source_remove(this._mainloop);
    Main.panel._menus.removeMenu(this.leftMenu);
    Main.panel._rightBox.remove_actor(this.actor);
  }
}

Signals.addSignalMethods(Indicator.prototype);

function init(metadata) {
  return new Indicator(metadata)
}
