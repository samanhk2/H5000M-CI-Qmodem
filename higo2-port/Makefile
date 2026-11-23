include $(TOPDIR)/rules.mk

PKG_NAME:=higo2-modem
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/higo2-modem
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=Higo2 modem manager + webui (ported from user-provided H5000M firmware)
  DEPENDS:=+jq +lua +ip-full
endef

define Build/Prepare
	$(CP) $(CURDIR)/bin/* $(PKG_BUILD_DIR)/
	$(CP) -r $(CURDIR)/libexec $(PKG_BUILD_DIR)/
	$(CP) -r $(CURDIR)/share $(PKG_BUILD_DIR)/
	$(CP) -r $(CURDIR)/init.d $(PKG_BUILD_DIR)/
	$(CP) -r $(CURDIR)/config $(PKG_BUILD_DIR)/
	$(CP) -r $(CURDIR)/www $(PKG_BUILD_DIR)/
	$(CP) -r $(CURDIR)/luci $(PKG_BUILD_DIR)/
	$(CP) -r $(CURDIR)/uci-defaults $(PKG_BUILD_DIR)/
endef

define Build/Compile
endef

define Package/higo2-modem/install
	$(INSTALL_DIR) $(1)/usr/bin $(1)/usr/libexec/modem $(1)/usr/share/modem \
		$(1)/etc/init.d $(1)/etc/config $(1)/www/webui \
		$(1)/usr/lib/lua/luci/controller $(1)/usr/share/luci/menu.d $(1)/etc/uci-defaults
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/modemwebui-server $(1)/usr/bin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/libexec/modem/* $(1)/usr/libexec/modem/
	$(CP) $(PKG_BUILD_DIR)/share/modem/* $(1)/usr/share/modem/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/init.d/* $(1)/etc/init.d/
	$(CP) $(PKG_BUILD_DIR)/config/* $(1)/etc/config/
	$(CP) -r $(PKG_BUILD_DIR)/www/webui/* $(1)/www/webui/
	$(CP) $(PKG_BUILD_DIR)/luci/*.lua $(1)/usr/lib/lua/luci/controller/
	$(CP) $(PKG_BUILD_DIR)/luci/*.json $(1)/usr/share/luci/menu.d/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/uci-defaults/* $(1)/etc/uci-defaults/
	chmod +x $(1)/usr/share/modem/*.sh 2>/dev/null || true
endef

$(eval $(call BuildPackage,higo2-modem))
