var Shouts = {

    member: 0, // The member whose profile we're on.
    poller: null, // Checks for new shouts, and for ones that have been deleted.
    checked: null, // The range of shouts that were on the page the last time we checked: {from: id, after: id}.

    init: function() {
        if (getById("shoutForm")) Shouts.initForm();

        if (typeof Poller != "undefined") {
            Shouts.poller = new Poller({
                interval: eso.autoReloadIntervalStart,
                multiplier: eso.autoReloadIntervalMultiplier,
                limit: eso.autoReloadIntervalLimit,
                request: Shouts.checkForNewShouts,
                update: Shouts.showNewShouts
            });
            Shouts.poller.start();
        }
    },

    initForm: function() {
        getById("shoutForm").onsubmit = function onsubmit() {
            Shouts.addShout(getById("shoutContent").value);
            return false;
        };
        disable(getById("shoutSubmit"));
        getById("shoutContent").onkeyup = function onkeydown() {
            window[this.value && !this.placeholder ? "enable" : "disable"](getById("shoutSubmit"));
        };
        getById("shoutContent").onkeypress = function onkeypress(e) {
            if (!e) e = window.event;
            if (e.ctrlKey && e.keyCode == 13) {
                if (!getById("shoutSubmit").classList.contains("buttonDisabled")) {
                    Shouts.addShout(getById("shoutContent").value);
                }
                return false;
            }
        }
        window.onbeforeunload = Shouts.beforeUnload;
    },

    addShout: function(content) {
        disable(getById("shoutSubmit"));
        Ajax.request({
            url: eso.baseURL + "ajax.php?controller=profile",
            post: "action=shout&memberTo=" + encodeURIComponent(this.member) + "&content=" + encodeURIComponent(content),
            success: function() {
                if (this.messages) {
                    enable(getById("shoutSubmit"));
                    return;
                } else disable(getById("shoutSubmit"));
                Shouts.insertShout(this.result.shoutId, this.result.html);
                getById("shoutContent").value = "";
                getById("shoutContent").blur();
                Messages.hideMessage("waitToReply");
                // Go back to checking for new shouts often.
                if (Shouts.poller) Shouts.poller.start();
            }
        });
    },

    deleteShout: function(shoutId) {
        if (!confirm(eso.language.confirmDeleteShout)) return;
        Ajax.request({
            url: eso.baseURL + "ajax.php?controller=profile",
            post: "action=deleteShout&shoutId=" + shoutId,
            success: function() {
                Shouts.animateDeleteShout(getById("shout" + shoutId));
            }
        });
    },

    insertShout: function(shoutId, html) {
        if (getById("shout" + shoutId)) return false;
        var div = document.createElement("div");
        div.innerHTML = html;
        div.id = "shout" + shoutId;
        div.style.overflow = "hidden";
        getById("shouts").insertBefore(div, getById("shouts").firstChild);
        Shouts.animateNewShout(div);
        return true;
    },

    getShoutIds: function() {
        var ids = [];
        var divs = getById("shouts").getElementsByTagName("div");
        for (var i = 0; i < divs.length; i++) {
            var match = divs[i].id.match(/^shout(\d+)$/);
            if (match && !divs[i].deleting) ids.push(parseInt(match[1]));
        }
        return ids;
    },

    checkForNewShouts: function() {
        var ids = Shouts.getShoutIds();
        var after = ids.length ? Math.max.apply(Math, ids) : 0;
        var from = ids.length ? Math.min.apply(Math, ids) : after + 1;
        Shouts.checked = {from: from, after: after};
        return {
            url: eso.baseURL + "ajax.php?controller=profile",
            post: "action=checkForNewShouts&memberTo=" + Shouts.member + "&after=" + after + "&from=" + from
        };
    },

    showNewShouts: function(result) {
        if (!result) return false;
        var changed = false;

        // Remove the shouts that were on the page when we checked, but don't exist any more.
        var ids = Shouts.getShoutIds();
        for (var i = 0; i < ids.length; i++) {
            if (ids[i] < Shouts.checked.from || ids[i] > Shouts.checked.after || ids[i] in result.times) continue;
            Shouts.animateDeleteShout(getById("shout" + ids[i]));
            changed = true;
        }

        for (var id in result.times) {
            var info = getById("shout" + id) && getElementsByClassName(getById("shout" + id), "pInfo")[0];
            var time = info && info.getElementsByTagName("span")[0];
            if (time) time.innerHTML = result.times[id];
        }

        if (result.newShouts) {
            Shouts.getNewShouts(Shouts.checked.after);
            changed = true;
        }

        return changed;
    },

    getNewShouts: function(after) {
        Ajax.request({
            url: eso.baseURL + "ajax.php?controller=profile",
            post: "action=getNewShouts&memberTo=" + Shouts.member + "&after=" + after,
            success: function() {
                for (var i = 0; i < this.result.length; i++) Shouts.insertShout(this.result[i].id, this.result[i].html);
            }
        });
    },

    animateNewShout: function(shout) {
        var overflowDiv = createOverflowDiv(shout);
        (overflowDiv.animation = new Animation(function(values, final) {
            overflowDiv.style.height = final ? "" : values[0] + "px";
            overflowDiv.style.opacity = final ? "" : values[1];
        }, {begin: [0, 0], end: [overflowDiv.offsetHeight, 1]})).start();
    },

    animateDeleteShout: function(shout) {
        if (!shout || shout.deleting) return;
        shout.deleting = true;
        shout.style.overflow = "hidden";
        (shout.animation = new Animation(function(opacity, final) {
            shout.style.opacity = opacity;
            if (opacity < .5 && !shout.collapsing) {
                shout.collapsing = true;
                (shout.animation = new Animation(function(height, final) {
                    shout.style.height = height + "px";
                    if (final) shout.parentNode.removeChild(shout);
                }, {begin: shout.offsetHeight, end: 0})).start();
            }
        }, {begin: 1, end: 0})).start();
    },

    beforeUnload: function onbeforeunload() {
        if (!getById("shoutSubmit").classList.contains("buttonDisabled")) return eso.language["confirmDiscard"];
    }

};