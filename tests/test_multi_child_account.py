import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class MultiChildAccountTests(unittest.TestCase):
    def read(self, relative_path: str) -> str:
        return (ROOT / relative_path).read_text(encoding="utf-8")

    def test_plan_limits_and_prices_are_centralized(self) -> None:
        plan = self.read("lib/account-plan.ts")

        self.assertIn("export const BILLING_ENABLED = false", plan)
        self.assertIn("export const SUBSCRIPTION_PLANS_VISIBLE = BILLING_ENABLED", plan)
        self.assertIn('free: {', plan)
        self.assertIn('family_monthly: {', plan)
        self.assertIn('family_yearly: {', plan)
        self.assertIn('childLimit: 1', plan)
        self.assertGreaterEqual(plan.count('childLimit: 3'), 2)
        self.assertIn('priceTwd: 49', plan)
        self.assertIn('priceTwd: 490', plan)

    def test_child_owner_index_allows_multiple_profiles(self) -> None:
        schema = self.read("db/schema.ts")
        migration = self.read("drizzle/0008_lively_nightshade.sql")

        self.assertIn('index("child_profiles_owner_idx").on(table.authUserId, table.id)', schema)
        self.assertNotIn('uniqueIndex("child_profiles_owner_idx")', schema)
        self.assertIn('DROP INDEX `child_profiles_owner_idx`', migration)
        self.assertIn('CREATE INDEX `child_profiles_owner_idx`', migration)

    def test_account_api_returns_owned_children_and_plan_capacity(self) -> None:
        route = self.read("app/api/account/route.ts")

        self.assertIn('children: children.map(publicChild)', route)
        self.assertIn('canAddChild: children.length < plan.childLimit', route)
        self.assertIn('children.find((item) => item.id === requestedChildId)', route)
        self.assertIn('WHERE auth_user_id = ?', route)

    def test_child_mutations_are_owner_scoped_and_plan_limited(self) -> None:
        route = self.read("app/api/account/child/route.ts")

        self.assertIn('WHERE id = ? AND auth_user_id = ?', route)
        self.assertIn('COUNT(*) FROM child_profiles WHERE auth_user_id = ?', route)
        self.assertIn('plan.childLimit', route)
        self.assertIn('CHILD_LIMIT_REACHED', route)

    def test_encounters_require_the_selected_owned_child(self) -> None:
        route = self.read("app/api/account/encounters/route.ts")
        app = self.read("web/app.js")

        self.assertIn('auth_user_id = ? AND id = ?', route)
        self.assertIn('const childId = requiredChildId(record.childId)', route)
        self.assertIn('childId: state.account.child?.id', app)

    def test_frontend_exposes_child_switching_without_paid_plan_marketing(self) -> None:
        index = self.read("web/index.html")
        app = self.read("web/app.js")
        records = self.read("web/records.js")

        self.assertNotIn('id="passportChildToolbar"', index)
        self.assertIn('id="accountAddChild"', index)
        self.assertIn('id="accountPlanOptions" hidden', index)
        self.assertIn('id="familyPlanComparison"', index)
        self.assertIn('aria-labelledby="familyPlanComparisonTitle" hidden', index)
        self.assertIn('id="accountPlanOptionsTemplate"', index)
        self.assertIn('id="familyPlanComparisonTemplate"', index)
        self.assertNotIn('目前不會進入付款', index)
        self.assertIn('account.billingEnabled === true && account.subscriptionPlansVisible === true', app)
        self.assertIn('refs.accountPlanOptions.replaceChildren()', app)
        self.assertIn('refs.familyPlanComparison.replaceChildren()', app)
        self.assertIn('demeter-active-child-id', app)
        self.assertIn('selectAccountChild', app)
        self.assertIn('recordsChildSelect', records)

    def test_passport_child_details_opens_only_that_child_settings(self) -> None:
        index = self.read("web/index.html")
        app = self.read("web/app.js")
        styles = self.read("web/styles.css")

        self.assertNotIn('id="childSwitcher"', index)
        self.assertIn('id="editChildButton" type="button" aria-haspopup="dialog"', index)
        self.assertIn('id="accountChildBack" type="button" hidden', index)
        self.assertIn('void openPassportChildSettings(state.account.child?.id, refs.editChildButton);', app)
        self.assertIn('function openPassportChildSettings(childId, trigger)', app)
        self.assertIn('openChildEditor(refs.childNickname, { trigger, childOnly: true });', app)
        self.assertIn('state.accountDialogView = childOnly ? "child" : "family";', app)
        self.assertIn('refs.accountSignedInView.classList.toggle("is-child-settings-view", childSettingsView);', app)
        self.assertIn('if (state.accountDialogView === "child") {', app)
        self.assertIn('refs.accountChildBack.click();', app)
        self.assertIn('.is-child-settings-view > .account-profile-hero,', styles)
        self.assertIn('.is-child-settings-view > .account-plan-panel,', styles)
        self.assertIn('.is-child-settings-view .account-child-list,', styles)

    def test_passport_plan_opens_a_dedicated_current_plan_dialog(self) -> None:
        index = self.read("web/index.html")
        app = self.read("web/app.js")
        styles = self.read("web/styles.css")

        self.assertIn('id="familyPlanDialog"', index)
        self.assertIn('id="familyPlanCurrentName"', index)
        self.assertIn('id="familyPlanFeatureList"', index)
        self.assertIn('id="familyPlanComparisonTemplate"', index)
        family_plan = index[
            index.index('id="familyPlanDialog"') : index.index('id="accountPlanOptionsTemplate"')
        ]
        self.assertNotIn('id="parentProfileForm"', family_plan)
        self.assertNotIn('id="accountChildEditor"', family_plan)
        self.assertIn('id="familyPlanComparison"', family_plan)
        self.assertNotIn('data-plan-id="family_monthly"', family_plan)
        self.assertNotIn('data-plan-id="family_yearly"', family_plan)
        self.assertIn('function openFamilyPlanDialog(trigger)', app)
        self.assertNotIn('refs.childPlanSummary', app)
        self.assertIn('openFamilyPlanDialog(trigger);', app)
        self.assertIn('state.lastFamilyPlanTrigger = trigger || document.activeElement;', app)
        self.assertIn('card.setAttribute("aria-current", "true")', app)
        self.assertIn('.family-plan-card.is-current', styles)
        self.assertIn('.family-plan-dialog { width:', styles)

    def test_account_api_exposes_disabled_billing_flags(self) -> None:
        route = self.read("app/api/account/route.ts")
        child_route = self.read("app/api/account/child/route.ts")

        self.assertIn("billingEnabled: BILLING_ENABLED", route)
        self.assertIn("subscriptionPlansVisible: SUBSCRIPTION_PLANS_VISIBLE", route)
        free_limit_message = child_route.split('plan.id === "free"', 1)[1].split(":", 1)[0]
        self.assertNotIn("家庭方案最多可建立 3 位", free_limit_message)
        self.assertIn("其他家庭功能若有調整，將另行公告", child_route)


if __name__ == "__main__":
    unittest.main()
