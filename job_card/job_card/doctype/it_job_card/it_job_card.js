// Copyright (c) 2026, one and contributors
// For license information, please see license.txt

frappe.ui.form.on("IT Job Card", {
	refresh(frm) {
		set_visitor_query(frm);
		set_supervisor_query(frm);
		bind_dirty_workflow_actions(frm);
		bind_reopen_action(frm);
		if (frm.doc.__unsaved || frm.doc.__islocal) {
			show_dirty_workflow_actions(frm);
		}
	},

	division(frm) {
		if (frm.doc.supervisor_incharge) {
			frm.set_value("supervisor_incharge", "");
		}
		set_supervisor_query(frm);
	},

	supervisor_incharge(frm) {
		if (frm.doc.__unsaved || frm.doc.__islocal) {
			show_dirty_workflow_actions(frm);
		}
	},

	dashboard_update(frm) {
		hide_empty_revisit_connection(frm);
	},
});

function bind_dirty_workflow_actions(frm) {
	if (frm.__dirty_workflow_actions_bound) {
		return;
	}

	frm.__dirty_workflow_actions_bound = true;
	$(frm.wrapper).on("dirty.it_job_card_workflow", () => {
		show_dirty_workflow_actions(frm);
	});
}

function bind_reopen_action(frm) {
	if (frm.__reopen_action_bound) {
		return;
	}

	frm.__reopen_action_bound = true;
	$(frm.wrapper).on("render_complete.it_job_card_reopen", () => {
		if (frm.doc.status === "Requires Revisit" && !frm.doc.__unsaved) {
			setTimeout(() => replace_reopen_action(frm), 0);
		}
	});
}

function hide_empty_revisit_connection(frm) {
	const link = frm.dashboard.transactions_area.find(
		'.document-link[data-doctype="IT Job Card"]'
	);
	const column = link.closest(".col-md-4");
	const has_connection =
		!link.find(".count").hasClass("hidden") ||
		!link.find(".open-notification").hasClass("hidden");

	column.toggle(has_connection);
}

async function replace_reopen_action(frm) {
	if (frm.doc.status !== "Requires Revisit" || frm.doc.__unsaved) {
		return;
	}

	const transitions = await frappe.workflow.get_transitions(frm.doc);
	if (!transitions.length) {
		return;
	}

	frm.page.clear_actions_menu();
	transitions.forEach((transition) => {
		if (transition.action === "Reopen" && frm.doc.reopened_as) {
			return;
		}

		frm.page.add_action_item(__(transition.action), () => {
			if (transition.action === "Reopen") {
				reopen_job_card(frm);
			} else {
				frappe.ui.form.States.prototype.handle_workflow_action.call(
					frm.states,
					transition
				);
			}
		});
	});
}

async function reopen_job_card(frm) {
	frappe.dom.freeze();

	try {
		const name = await frappe.xcall(
			"job_card.job_card.doctype.it_job_card.it_job_card.reopen_it_job_card",
			{name: frm.doc.name}
		);
		frappe.set_route("Form", "IT Job Card", name);
	} finally {
		frappe.dom.unfreeze();
	}
}

async function show_dirty_workflow_actions(frm) {
	if (!frm.doc.__unsaved && !frm.doc.__islocal) {
		return;
	}

	const request_id = (frm.__workflow_actions_request_id || 0) + 1;
	frm.__workflow_actions_request_id = request_id;

	const transitions = await frappe.xcall(
		"job_card.job_card.doctype.it_job_card.it_job_card.get_it_job_card_workflow_actions",
		{ doc: frm.doc }
	);

	if (
		request_id !== frm.__workflow_actions_request_id ||
		(!frm.doc.__unsaved && !frm.doc.__islocal)
	) {
		return;
	}

	frm.page.clear_actions_menu();
	frm.page.btn_primary.addClass("hide");
	frm.page.add_action_item(__("Save"), () => save_dirty_form(frm));

	transitions.forEach((transition) => {
		frm.page.add_action_item(__(transition.action), () => {
			if (transition.action === "Reopen") {
				reopen_job_card(frm);
			} else {
				handle_dirty_workflow_action(frm, transition.action);
			}
		});
	});
}

async function save_dirty_form(frm) {
	frappe.dom.freeze();

	try {
		await frm.save();
		frm.refresh();
	} finally {
		frappe.dom.unfreeze();
	}
}

async function handle_dirty_workflow_action(frm, action) {
	frappe.dom.freeze();
	frm.selected_workflow_action = action;

	try {
		await frm.script_manager.trigger("before_workflow_action");
		await frm.save();
		const doc = await frappe.xcall("frappe.model.workflow.apply_workflow", {
			doc: frm.doc,
			action,
		});
		frappe.model.sync(doc);
		frm.refresh();
		await frm.script_manager.trigger("after_workflow_action");
	} finally {
		frm.selected_workflow_action = null;
		frappe.dom.unfreeze();
	}
}

function set_visitor_query(frm) {
	frm.set_query("visitor", function () {
		return {
			query: "job_card.job_card.doctype.it_job_card.it_job_card.get_it_team_users",
		};
	});
}

function set_supervisor_query(frm) {
	frm.set_query("supervisor_incharge", function () {
		return {
			query: "job_card.job_card.doctype.it_job_card.it_job_card.get_division_supervisors",
			filters: {
				division: frm.doc.division,
			},
		};
	});
}
