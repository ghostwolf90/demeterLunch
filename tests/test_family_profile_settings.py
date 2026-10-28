from __future__ import annotations

import unittest
from pathlib import Path


class FamilyProfileSettingsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(__file__).resolve().parents[1]

    def read(self, relative: str) -> str:
        return (self.root / relative).read_text(encoding="utf-8")

    def test_profile_fields_are_durable_and_migrated(self) -> None:
        schema = self.read("db/schema.ts")
        migration = self.read("drizzle/0010_great_hulk.sql")
        self.assertIn('nickname: text("nickname")', schema)
        self.assertGreaterEqual(schema.count('avatarKey: text("avatar_key")'), 2)
        self.assertIn('name: text("name")', schema)
        self.assertIn('subscriptionStatus: text("subscription_status")', schema)
        self.assertIn("ADD `name` text", migration)
        self.assertIn("ADD `avatar_key` text", migration)
        self.assertIn("ADD `subscription_status` text", migration)

    def test_profile_and_avatar_mutations_are_owner_scoped(self) -> None:
        profile = self.read("app/api/account/profile/route.ts")
        avatar = self.read("app/api/account/avatar/route.ts")
        account = self.read("app/api/account/route.ts")
        self.assertIn("WHERE auth_user_id = ?", profile)
        self.assertIn("WHERE id = ? AND auth_user_id = ?", avatar)
        self.assertIn("env.BUCKET", avatar)
        self.assertIn("MAX_AVATAR_BYTES", avatar)
        self.assertIn('cache-control", "private', avatar)
        self.assertIn('displayName: nickname || "孩子"', account)
        self.assertIn("accountSubscriptionDetails", account)

    def test_account_settings_expose_parent_children_and_subscription(self) -> None:
        html = self.read("web/index.html")
        app = self.read("web/app.js")
        profile = self.read("lib/account-profile.ts")
        records = self.read("web/records.js")
        for element_id in (
            "parentProfileForm",
            "parentAvatarInput",
            "accountChildList",
            "accountSubscriptionState",
            "accountSubscriptionDetail",
            "childNickname",
            "childAvatarInput",
        ):
            self.assertIn(f'id="{element_id}"', html)
        self.assertIn('profileDisplayName(account.user, "家庭帳號")', app)
        self.assertNotIn('name: refs.childName.value', app)
        self.assertIn('nickname: refs.childNickname.value', app)
        self.assertIn('await uploadAvatar("child"', app)
        self.assertIn('await uploadAvatar("parent"', app)
        self.assertIn("childDisplayName(state.account.child)", records)
        self.assertIn("目前使用免費方案。", html)
        self.assertIn("目前使用免費方案。", app)
        self.assertIn("目前使用免費方案。", profile)
        self.assertNotIn("自動扣款", html)
        self.assertNotIn("自動扣款", app)
        self.assertNotIn("自動扣款", profile)

    def test_child_editor_stays_inside_account_settings_and_fields_match(self) -> None:
        html = self.read("web/index.html")
        app = self.read("web/app.js")
        styles = self.read("web/styles.css")
        passport_prompt = html[
            html.index('id="passportSetup"') : html.index('id="passportWorkspace"')
        ]
        account_editor = html[
            html.index('id="accountChildEditor"') : html.index('id="accountPlanPanel"')
        ]
        self.assertNotIn('id="childForm"', passport_prompt)
        self.assertIn('id="childForm"', account_editor)
        self.assertNotIn('孩子本名', account_editor)
        self.assertIn('class="field-heading">孩子暱稱', account_editor)
        self.assertIn('openChildEditor(refs.childNickname, { trigger: edit })', app)
        self.assertNotIn('await closeAccountDialog({ restoreFocus: false })', app)
        self.assertIn('.profile-settings-grid input { width: 100%; height: 44px;', styles)
        self.assertIn('.child-form > label > input, .child-form > label > select { height: 46px;', styles)

    def test_cancelling_avatar_picker_does_not_close_account_settings(self) -> None:
        app = self.read("web/app.js")

        dialog_cancel = app.split('refs.accountDialog.addEventListener("cancel", (event) => {', 1)[1]
        dialog_cancel = dialog_cancel.split("});", 1)[0]
        self.assertIn("if (event.target !== refs.accountDialog) return;", dialog_cancel)
        self.assertIn("closeAccountDialog();", dialog_cancel)

    def test_mobile_avatar_upload_uses_the_actual_canvas_output_type(self) -> None:
        html = self.read("web/index.html")
        app = self.read("web/app.js")

        self.assertEqual(html.count("image/heic,image/heif"), 2)
        self.assertIn('typeof createImageBitmap === "function"', app)
        self.assertIn('outputType = blob.type.toLowerCase()', app)
        self.assertIn('return new File([blob], `avatar.${extension}`, { type: outputType });', app)
        self.assertNotIn('new File([blob], "avatar.webp", { type: "image/webp" })', app)

    def test_photo_action_buttons_share_the_same_dimensions_and_style(self) -> None:
        styles = self.read("web/styles.css")

        self.assertIn(
            ".profile-photo-actions label, .profile-photo-actions .profile-photo-remove { min-width: 104px; min-height: 36px;",
            styles,
        )


if __name__ == "__main__":
    unittest.main()
