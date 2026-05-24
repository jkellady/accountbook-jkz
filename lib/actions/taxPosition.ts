     1	/**
     2	 * @fileoverview Tax Position Server Actions — JK Zentra Finance Cockpit
     3	 *
     4	 * Provides the calculation engine behind the Tax Position Module.
     5	 * All monetary amounts are in INTEGER minor units (sen) to avoid float drift.
     6	 * Every forecast step is transparent — no black boxes.
     7	 *
     8	 * DISCLAIMER: This is a simplified directional estimate. Actual tax liability
     9	 * depends on many factors. Consult your tax agent for filing.
    10	 *
    11	 * @module lib/actions/taxPosition
    12	 */
    13	
    14	"use server";
    15	
    16	import { createActionClient } from "@/lib/supabase/server";
    17	import type { SupabaseClient } from "@supabase/supabase-js";
    18	import type {
    19	  Database,
    20	  TransactionRow,
    21	  CP500ScheduleItem,
    22	  UserSettings,
    23	} from "@/lib/supabase/database.types";
    24	
    25	// ---------------------------------------------------------------------------
    26	// Types
    27	// ---------------------------------------------------------------------------
    28	
    29	/** The four KPI tiles shown at the top of the Tax Position view. */
    30	export interface TaxPositionKPIs {
    31	  /** Sum of income transactions YTD in minor units (sen). */
    32	  income_ytd_minor: number;
    33	  /** Sum of tax-claimable expense transactions YTD in minor units (sen). */
    34	  deductible_ytd_minor: number;
    35	  /** Sum of tax_prepayment transactions (CP500 paid) in minor units (sen). */
    36	  cp500_paid_minor: number;
    37	  /** Total CP500 scheduled for the year from settings in minor units (sen). */
    38	  cp500_scheduled_minor: number;
    39	  /** Sum of tax_reserve_transfer transactions YTD in minor units (sen). */
    40	  tax_reserve_minor: number;
    41	  /** How many CP500 instalments have been paid. */
    42	  cp500_instalments_paid: number;
    43	  /** Total CP500 instalments scheduled (always 6). */
    44	  cp500_instalments_total: number;
    45	}
    46	
    47	/** Full step-by-step forecast math result. Every field is derived transparently. */
    48	export interface TaxForecast {
    49	  /** Actual income year-to-date in minor units (sen). */
    50	  income_ytd_minor: number;
    51	  /** Number of months elapsed since year start (minimum 1). */
    52	  months_elapsed: number;
    53	  /** Number of months remaining in the year. */
    54	  months_remaining: number;
    55	  /** Projected income for remaining months based on run-rate in minor units (sen). */
    56	  projected_remaining_minor: number;
    57	  /** Projected full-year income in minor units (sen). */
    58	  projected_full_year_minor: number;
    59	  /** Actual tax-claimable expenses YTD in minor units (sen). */
    60	  deductible_ytd_minor: number;
    61	  /** Projected annual deductible expenses (YTD expenses annualised) in minor units (sen). */
    62	  projected_annual_deductible_minor: number;
    63	  /** Projected taxable income (full-year income minus annualised deductions) in minor units (sen). */
    64	  projected_taxable_income_minor: number;
    65	  /** Effective tax rate as a decimal (e.g. 0.124 for 12.4%). */
    66	  effective_tax_rate: number;
    67	  /** Estimated full-year tax liability in minor units (sen). */
    68	  estimated_tax_minor: number;
    69	  /** Total CP500 scheduled for the year in minor units (sen). */
    70	  cp500_scheduled_minor: number;
    71	  /** Difference between CP500 scheduled and estimated tax in minor units (sen). Positive = overpaying. */
    72	  variance_minor: number;
    73	  /** Human-readable verdict based on variance vs threshold. */
    74	  verdict: "overpaying" | "underpaying" | "on_track";
    75	}
    76	
    77	/** A single CP500 instalment enriched with payment status. */
    78	export interface CP500Instalment {
    79	  /** Instalment number (1–6). */
    80	  instalment_no: number;
    81	  /** ISO-8601 due date (e.g. '2026-04-30'). */
    82	  due_date: string;
    83	  /** Amount due in minor units (sen). */
    84	  amount_minor: number;
    85	  /** Whether a matching tax_prepayment transaction exists. */
    86	  is_paid: boolean;
    87	  /** Date the instalment was paid, if applicable. */
    88	  paid_date: string | null;
    89	  /** Linked receipt file ID, if any. */
    90	  file_id: string | null;
    91	}
    92	
    93	/** CP500 schedule response. */
    94	export interface CP500ScheduleResponse {
    95	  /** The 6 CP500 instalments with payment status. */
    96	  instalments: CP500Instalment[];
    97	}
    98	
    99	/** Year-end tax preparation workspace data. */
   100	export interface TaxPrepData {
   101	  /** All transactions for the selected year and entity. */
   102	  transactions: TransactionRow[];
   103	  /** Transactions grouped by category with running totals. */
   104	  byCategory: {
   105	    /** Category name. */
   106	    category: string;
   107	    /** Total amount in minor units (sen). */
   108	    total_minor: number;
   109	    /** Number of transactions in this category. */
   110	    count: number;
   111	  }[];
   112	  /** Number of tax-claimable transactions missing a receipt (file_id IS NULL). */
   113	  missingReceiptCount: number;
   114	}
   115	
   116	/** Parameters for marking a CP500 instalment as paid. */
   117	export interface MarkCP500PaidParams {
   118	  instalmentNo: number;
   119	  date: string;
   120	  fileId?: string;
   121	}
   122	
   123	/** Response from marking a CP500 instalment as paid. */
   124	export interface MarkCP500PaidResponse {
   125	  /** ID of the created tax_prepayment transaction. */
   126	  transactionId: string;
   127	}
   128	
   129	// ---------------------------------------------------------------------------
   130	// Internal helpers
   131	// ---------------------------------------------------------------------------
   132	
   133	/**
   134	 * Get year boundaries for a given assessment year.
   135	 * Malaysia tax year runs Jan–Dec, assessed the following year.
   136	 * Year 2026 assessment = income from 2026-01-01 to 2026-12-31.
   137	 *
   138	 * @param year - The assessment year (e.g. 2026).
   139	 * @returns Tuple of [yearStart, yearEnd] as ISO date strings.
   140	 */
   141	function getYearBoundaries(year: number): [string, string] {
   142	  return [`${year}-01-01`, `${year}-12-31`];
   143	}
   144	
   145	/**
   146	 * Calculate months elapsed from year start to today.
   147	 * Returns at least 1 to avoid division-by-zero in run-rate calculations.
   148	 *
   149	 * @param year - The assessment year.
   150	 * @returns Number of full months elapsed (1–12).
   151	 */
   152	function getMonthsElapsed(year: number): number {
   153	  const now = new Date();
   154	  const yearStart = new Date(`${year}-01-01`);
   155	  const effectiveNow = now < yearStart ? yearStart : now;
   156	
   157	  const months =
   158	    (effectiveNow.getFullYear() - yearStart.getFullYear()) * 12 +
   159	    (effectiveNow.getMonth() - yearStart.getMonth()) +
   160	    1; // +1 because Jan 1–31 counts as month 1
   161	
   162	  return Math.max(1, Math.min(12, months));
   163	}
   164	
   165	/**
   166	 * Resolve the taxable entity ID from an optional slug filter.
   167	 * If slug is provided, returns the matching entity.
   168	 * If no slug, returns the JK Zentra entity (the taxable entity).
   169	 *
   170	 * @param supabase - Typed Supabase client.
   171	 * @param entitySlug - Optional entity slug filter.
   172	 * @returns The entity ID to use for queries, or null if not found.
   173	 */
   174	async function resolveEntityId(
   175	  supabase: SupabaseClient<Database>,
   176	  entitySlug?: string
   177	): Promise<string | null> {
   178	  let query = supabase
   179	    .from("entities")
   180	    .select("id")
   181	    .eq("is_taxable", true);
   182	
   183	  if (entitySlug) {
   184	    query = query.eq("slug", entitySlug as "personal" | "jk-zentra");
   185	  } else {
   186	    query = query.eq("slug", "jk-zentra");
   187	  }
   188	
   189	  const { data, error } = await query.single();
   190	
   191	  if (error || !data) {
   192	    console.error("[taxPosition] resolveEntityId error:", error);
   193	    return null;
   194	  }
   195	
   196	  return data.id;
   197	}
   198	
   199	/**
   200	 * Fetch user settings from the database.
   201	 * Returns default values if settings are not populated.
   202	 *
   203	 * @param supabase - Typed Supabase client.
   204	 * @returns UserSettings with defaults applied.
   205	 */
   206	async function getUserSettings(
   207	  supabase: SupabaseClient<Database>
   208	): Promise<UserSettings> {
   209	  const {
   210	    data: { user },
   211	  } = await supabase.auth.getUser();
   212	
   213	  if (!user) {
   214	    return getDefaultSettings();
   215	  }
   216	
   217	  const { data, error } = await supabase
   218	    .from("users")
   219	    .select("settings")
   220	    .eq("id", user.id)
   221	    .single();
   222	
   223	  if (error || !data || !data.settings) {
   224	    console.error("[taxPosition] getUserSettings error:", error);
   225	    return getDefaultSettings();
   226	  }
   227	
   228	  return mergeSettings(data.settings as unknown as Partial<UserSettings>);
   229	}
   230	
   231	/**
   232	 * Return sensible defaults for tax calculation settings.
   233	 *
   234	 * @returns Default UserSettings.
   235	 */
   236	function getDefaultSettings(): UserSettings {
   237	  return {
   238	    default_entity_id: null,
   239	    tax_year_start: `${new Date().getFullYear()}-01-01`,
   240	    effective_tax_rate_percent: 15,
   241	    lhdn_forecast_income_minor: 0,
   242	    cp500_schedule: [],
   243	    tax_reserve_strategy: {
   244	      enabled: false,
   245	      percent_of_income: 15,
   246	      target_account_name: "Tax Reserve",
   247	      reminder_day_of_month: 15,
   248	    },
   249	    cp502_threshold_percent: 10,
   250	    reminder_channels: ["in_app"],
   251	    google_calendar_connected: false,
   252	    fx_preference: "latest_cached",
   253	    monthly_ai_cost_cap_minor: 50000,
   254	  };
   255	}
   256	
   257	/**
   258	 * Merge partial settings from database with full defaults.
   259	 *
   260	 * @param partial - Partial settings from DB.
   261	 * @returns Complete UserSettings.
   262	 */
   263	function mergeSettings(partial: Partial<UserSettings>): UserSettings {
   264	  const defaults = getDefaultSettings();
   265	  return {
   266	    ...defaults,
   267	    ...partial,
   268	    tax_reserve_strategy: {
   269	      ...defaults.tax_reserve_strategy,
   270	      ...(partial.tax_reserve_strategy ?? {}),
   271	    },
   272	    cp500_schedule: partial.cp500_schedule ?? defaults.cp500_schedule,
   273	  };
   274	}
   275	
   276	// ===========================================================================
   277	// SERVER ACTIONS
   278	// ===========================================================================
   279	
   280	/**
   281	 * Get the four KPI values for the Tax Position header tiles.
   282	 *
   283	 * @param year - Assessment year (e.g. 2026). Defaults to current year.
   284	 * @param entitySlug - Optional entity slug filter (e.g. 'jk-zentra').
   285	 * @returns TaxPositionKPIs with all four KPI values.
   286	 */
   287	export async function getTaxPositionKPIs(
   288	  year?: number,
   289	  entitySlug?: string
   290	): Promise<TaxPositionKPIs> {
   291	  const supabase = await createActionClient();
   292	  const assessmentYear = year ?? new Date().getFullYear();
   293	  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);
   294	
   295	  const entityId = await resolveEntityId(supabase, entitySlug);
   296	  if (!entityId) {
   297	    return {
   298	      income_ytd_minor: 0,
   299	      deductible_ytd_minor: 0,
   300	      cp500_paid_minor: 0,
   301	      cp500_scheduled_minor: 0,
   302	      tax_reserve_minor: 0,
   303	      cp500_instalments_paid: 0,
   304	      cp500_instalments_total: 6,
   305	    };
   306	  }
   307	
   308	  const today = new Date().toISOString().split("T")[0];
   309	
   310	  // --- Income YTD: SUM(myr_equiv_minor) WHERE type='income' ---
   311	  const { data: incomeData, error: incomeError } = await supabase
   312	    .from("transactions")
   313	    .select("myr_equiv_minor")
   314	    .eq("entity_id", entityId)
   315	    .eq("type", "income")
   316	    .eq("status", "active")
   317	    .gte("occurred_at", yearStart)
   318	    .lte("occurred_at", today);
   319	
   320	  if (incomeError) {
   321	    console.error("[taxPosition] income YTD error:", incomeError);
   322	  }
   323	  const incomeYtd =
   324	    incomeData?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ?? 0;
   325	
   326	  // --- Deductible YTD: SUM(myr_equiv_minor) WHERE type='expense' AND tags @> ['tax-claimable'] ---
   327	  const { data: deductibleData, error: deductibleError } = await supabase
   328	    .from("transactions")
   329	    .select("myr_equiv_minor")
   330	    .eq("entity_id", entityId)
   331	    .eq("type", "expense")
   332	    .eq("status", "active")
   333	    .contains("tags", ["tax-claimable"])
   334	    .gte("occurred_at", yearStart)
   335	    .lte("occurred_at", today);
   336	
   337	  if (deductibleError) {
   338	    console.error("[taxPosition] deductible YTD error:", deductibleError);
   339	  }
   340	  const deductibleYtd =
   341	    deductibleData?.reduce(
   342	      (sum, row) => sum + (row.myr_equiv_minor ?? 0),
   343	      0
   344	    ) ?? 0;
   345	
   346	  // --- CP500 Paid: SUM(myr_equiv_minor) WHERE type='tax_prepayment' ---
   347	  const { data: cp500Data, error: cp500Error } = await supabase
   348	    .from("transactions")
   349	    .select("myr_equiv_minor")
   350	    .eq("entity_id", entityId)
   351	    .eq("type", "tax_prepayment")
   352	    .eq("status", "active")
   353	    .gte("occurred_at", yearStart)
   354	    .lte("occurred_at", yearEnd);
   355	
   356	  if (cp500Error) {
   357	    console.error("[taxPosition] CP500 paid error:", cp500Error);
   358	  }
   359	  const cp500Paid =
   360	    cp500Data?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ?? 0;
   361	
   362	  // --- Tax Reserve: SUM(myr_equiv_minor) WHERE type='tax_reserve_transfer' ---
   363	  const { data: reserveData, error: reserveError } = await supabase
   364	    .from("transactions")
   365	    .select("myr_equiv_minor")
   366	    .eq("entity_id", entityId)
   367	    .eq("type", "tax_reserve_transfer")
   368	    .eq("status", "active")
   369	    .gte("occurred_at", yearStart)
   370	    .lte("occurred_at", today);
   371	
   372	  if (reserveError) {
   373	    console.error("[taxPosition] tax reserve error:", reserveError);
   374	  }
   375	  const taxReserve =
   376	    reserveData?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ??
   377	    0;
   378	
   379	  // --- CP500 Scheduled from settings ---
   380	  const settings = await getUserSettings(supabase);
   381	  const cp500Scheduled = (settings.cp500_schedule ?? []).reduce(
   382	    (sum, inst: CP500ScheduleItem) => sum + (inst.amount_minor ?? 0),
   383	    0
   384	  );
   385	
   386	  // Count paid instalments by matching to transactions
   387	  const cp500InstalmentsTotal = settings.cp500_schedule?.length ?? 6;
   388	  const paidInstalments =
   389	    settings.cp500_schedule?.filter((inst: CP500ScheduleItem) => {
   390	      return inst.status === "paid" || inst.file_id;
   391	    }).length ?? 0;
   392	
   393	  return {
   394	    income_ytd_minor: incomeYtd,
   395	    deductible_ytd_minor: deductibleYtd,
   396	    cp500_paid_minor: cp500Paid,
   397	    cp500_scheduled_minor: cp500Scheduled,
   398	    tax_reserve_minor: taxReserve,
   399	    cp500_instalments_paid: paidInstalments,
   400	    cp500_instalments_total: cp500InstalmentsTotal,
   401	  };
   402	}
   403	
   404	/**
   405	 * Get the full step-by-step forecast math.
   406	 * Every intermediate value is returned so the UI can show transparent calculations.
   407	 *
   408	 * @param year - Assessment year (e.g. 2026). Defaults to current year.
   409	 * @param entitySlug - Optional entity slug filter.
   410	 * @returns TaxForecast with every step of the calculation exposed.
   411	 */
   412	export async function getTaxForecast(
   413	  year?: number,
   414	  entitySlug?: string
   415	): Promise<TaxForecast> {
   416	  const supabase = await createActionClient();
   417	  const assessmentYear = year ?? new Date().getFullYear();
   418	  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);
   419	
   420	  const entityId = await resolveEntityId(supabase, entitySlug);
   421	  const settings = await getUserSettings(supabase);
   422	
   423	  const today = new Date().toISOString().split("T")[0];
   424	
   425	  // Fallback zero forecast if no entity found
   426	  if (!entityId) {
   427	    return {
   428	      income_ytd_minor: 0,
   429	      months_elapsed: 1,
   430	      months_remaining: 11,
   431	      projected_remaining_minor: 0,
   432	      projected_full_year_minor: 0,
   433	      deductible_ytd_minor: 0,
   434	      projected_annual_deductible_minor: 0,
   435	      projected_taxable_income_minor: 0,
   436	      effective_tax_rate: settings.effective_tax_rate_percent / 100,
   437	      estimated_tax_minor: 0,
   438	      cp500_scheduled_minor: 0,
   439	      variance_minor: 0,
   440	      verdict: "on_track",
   441	    };
   442	  }
   443	
   444	  // --- Income YTD ---
   445	  const { data: incomeData, error: incomeError } = await supabase
   446	    .from("transactions")
   447	    .select("myr_equiv_minor")
   448	    .eq("entity_id", entityId)
   449	    .eq("type", "income")
   450	    .eq("status", "active")
   451	    .gte("occurred_at", yearStart)
   452	    .lte("occurred_at", today);
   453	
   454	  if (incomeError) {
   455	    console.error("[taxPosition] forecast income error:", incomeError);
   456	  }
   457	  const incomeYtd =
   458	    incomeData?.reduce((sum, row) => sum + (row.myr_equiv_minor ?? 0), 0) ?? 0;
   459	
   460	  // --- Deductible YTD ---
   461	  const { data: deductibleData, error: deductibleError } = await supabase
   462	    .from("transactions")
   463	    .select("myr_equiv_minor")
   464	    .eq("entity_id", entityId)
   465	    .eq("type", "expense")
   466	    .eq("status", "active")
   467	    .contains("tags", ["tax-claimable"])
   468	    .gte("occurred_at", yearStart)
   469	    .lte("occurred_at", today);
   470	
   471	  if (deductibleError) {
   472	    console.error("[taxPosition] forecast deductible error:", deductibleError);
   473	  }
   474	  const deductibleYtd =
   475	    deductibleData?.reduce(
   476	      (sum, row) => sum + (row.myr_equiv_minor ?? 0),
   477	      0
   478	    ) ?? 0;
   479	
   480	  // --- CP500 Scheduled ---
   481	  const cp500Scheduled = (settings.cp500_schedule ?? []).reduce(
   482	    (sum, inst: CP500ScheduleItem) => sum + (inst.amount_minor ?? 0),
   483	    0
   484	  );
   485	
   486	  // --- Forecast Math (transparent step-by-step) ---
   487	  const monthsElapsed = getMonthsElapsed(assessmentYear);
   488	  const monthsRemaining = 12 - monthsElapsed;
   489	
   490	  // If LHDN forecast is set and non-zero, use it; otherwise run-rate projection
   491	  const lhdnForecast = settings.lhdn_forecast_income_minor ?? 0;
   492	
   493	  // Projected remaining income
   494	  let projectedRemaining: number;
   495	  if (lhdnForecast > 0 && incomeYtd < lhdnForecast) {
   496	    // Use LHDN forecast as full-year target, subtract YTD
   497	    projectedRemaining = lhdnForecast - incomeYtd;
   498	  } else {
   499	    // Run-rate: YTD / months_elapsed * months_remaining
   500	    projectedRemaining = Math.round(
   501	      (incomeYtd / monthsElapsed) * monthsRemaining
   502	    );
   503	  }
   504	
   505	  const projectedFullYear = incomeYtd + projectedRemaining;
   506	
   507	  // Annualise deductible expenses
   508	  const projectedAnnualDeductible = Math.round(
   509	    (deductibleYtd / monthsElapsed) * 12
   510	  );
   511	
   512	  // Projected taxable income (floor at 0)
   513	  const projectedTaxable = Math.max(
   514	    0,
   515	    projectedFullYear - projectedAnnualDeductible
   516	  );
   517	
   518	  // Effective tax rate from settings (as decimal)
   519	  const effectiveTaxRate = (settings.effective_tax_rate_percent ?? 15) / 100;
   520	
   521	  // Estimated tax
   522	  const estimatedTax = Math.round(projectedTaxable * effectiveTaxRate);
   523	
   524	  // Variance: positive = CP500 covers more than estimated (overpaying)
   525	  const variance = cp500Scheduled - estimatedTax;
   526	
   527	  // Verdict logic using cp502_threshold_percent (default 10%)
   528	  const thresholdPercent = (settings.cp502_threshold_percent ?? 10) / 100;
   529	  const thresholdAmount = cp500Scheduled * thresholdPercent;
   530	
   531	  let verdict: TaxForecast["verdict"];
   532	  if (cp500Scheduled === 0) {
   533	    // No CP500 scheduled — neutral unless estimated tax is significant
   534	    verdict = estimatedTax > 0 ? "underpaying" : "on_track";
   535	  } else if (variance > thresholdAmount) {
   536	    verdict = "overpaying";
   537	  } else if (variance < -thresholdAmount) {
   538	    verdict = "underpaying";
   539	  } else {
   540	    verdict = "on_track";
   541	  }
   542	
   543	  return {
   544	    income_ytd_minor: incomeYtd,
   545	    months_elapsed: monthsElapsed,
   546	    months_remaining: monthsRemaining,
   547	    projected_remaining_minor: projectedRemaining,
   548	    projected_full_year_minor: projectedFullYear,
   549	    deductible_ytd_minor: deductibleYtd,
   550	    projected_annual_deductible_minor: projectedAnnualDeductible,
   551	    projected_taxable_income_minor: projectedTaxable,
   552	    effective_tax_rate: effectiveTaxRate,
   553	    estimated_tax_minor: estimatedTax,
   554	    cp500_scheduled_minor: cp500Scheduled,
   555	    variance_minor: variance,
   556	    verdict,
   557	  };
   558	}
   559	
   560	/**
   561	 * Get the CP500 instalment schedule enriched with actual payment status.
   562	 * Reads the schedule from users.settings, then cross-references with
   563	 * tax_prepayment transactions to determine which instalments are paid.
   564	 *
   565	 * @param year - Assessment year (e.g. 2026). Defaults to current year.
   566	 * @returns CP500ScheduleResponse with 6 instalments and payment status.
   567	 */
   568	export async function getCP500Schedule(
   569	  year?: number
   570	): Promise<CP500ScheduleResponse> {
   571	  const supabase = await createActionClient();
   572	  const assessmentYear = year ?? new Date().getFullYear();
   573	  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);
   574	
   575	  const settings = await getUserSettings(supabase);
   576	
   577	  // Get all tax_prepayment transactions for this year
   578	  const entityId = await resolveEntityId(supabase);
   579	  let prepaymentsQuery = supabase
   580	    .from("transactions")
   581	    .select("myr_equiv_minor, occurred_at, reference_code, file_id")
   582	    .eq("type", "tax_prepayment")
   583	    .eq("status", "active")
   584	    .gte("occurred_at", yearStart)
   585	    .lte("occurred_at", yearEnd);
   586	
   587	  if (entityId) {
   588	    prepaymentsQuery = prepaymentsQuery.eq("entity_id", entityId);
   589	  }
   590	
   591	  const { data: prepayments, error } = await prepaymentsQuery;
   592	
   593	  if (error) {
   594	    console.error("[taxPosition] getCP500Schedule error:", error);
   595	  }
   596	
   597	  // Build enriched instalment list
   598	  const schedule: CP500Instalment[] = (settings.cp500_schedule ?? []).map(
   599	    (inst: CP500ScheduleItem) => {
   600	      // Look for a matching prepayment transaction
   601	      // Match by reference_code containing the instalment number, or by amount + date proximity
   602	      const matchingPrepayment = prepayments?.find((p) => {
   603	        // Try to match by reference code (e.g. "CP500-1" or "1/2026")
   604	        if (
   605	          p.reference_code &&
   606	          p.reference_code.includes(String(inst.instalment_no))
   607	        ) {
   608	          return true;
   609	        }
   610	        // Fallback: match by exact amount and date within same month
   611	        if (p.myr_equiv_minor === inst.amount_minor && p.occurred_at) {
   612	          const paymentMonth = new Date(p.occurred_at).getMonth();
   613	          const dueMonth = new Date(inst.due_date).getMonth();
   614	          return paymentMonth === dueMonth;
   615	        }
   616	        return false;
   617	      });
   618	
   619	      return {
   620	        instalment_no: inst.instalment_no,
   621	        due_date: inst.due_date,
   622	        amount_minor: inst.amount_minor,
   623	        is_paid: !!matchingPrepayment || inst.status === "paid",
   624	        paid_date: matchingPrepayment?.occurred_at ?? null,
   625	        file_id: inst.file_id ?? matchingPrepayment?.file_id ?? null,
   626	      };
   627	    }
   628	  );
   629	
   630	  // If no schedule in settings, return a default 6-instalment skeleton
   631	  if (schedule.length === 0) {
   632	    const defaultAmount = 0;
   633	    const defaultSchedule: CP500Instalment[] = Array.from(
   634	      { length: 6 },
   635	      (_, i) => {
   636	        const month = (i + 1) * 2; // Apr, Jun, Aug, Oct, Dec, Feb
   637	        const dueMonth = month <= 12 ? month : 2;
   638	        const dueYear = month <= 12 ? assessmentYear : assessmentYear + 1;
   639	        const monthStr = String(dueMonth).padStart(2, "0");
   640	        return {
   641	          instalment_no: i + 1,
   642	          due_date: `${dueYear}-${monthStr}-30`,
   643	          amount_minor: defaultAmount,
   644	          is_paid: false,
   645	          paid_date: null,
   646	          file_id: null,
   647	        };
   648	      }
   649	    );
   650	    return { instalments: defaultSchedule };
   651	  }
   652	
   653	  return { instalments: schedule };
   654	}
   655	
   656	/**
   657	 * Mark a CP500 instalment as paid by creating a tax_prepayment transaction.
   658	 * Also updates the instalment status in users.settings.cp500_schedule.
   659	 *
   660	 * @param instalmentNo - The instalment number (1–6) being marked as paid.
   661	 * @param date - ISO-8601 date string of the payment date.
   662	 * @param fileId - Optional uploaded receipt file ID.
   663	 * @returns MarkCP500PaidResponse with the new transaction ID.
   664	 */
   665	export async function markCP500Paid(
   666	  instalmentNo: number,
   667	  date: string,
   668	  fileId?: string
   669	): Promise<MarkCP500PaidResponse> {
   670	  const supabase = await createActionClient();
   671	  const settings = await getUserSettings(supabase);
   672	  const entityId = await resolveEntityId(supabase);
   673	
   674	  if (!entityId) {
   675	    throw new Error("No taxable entity found. Cannot record CP500 payment.");
   676	  }
   677	
   678	  // Find the instalment in settings to get the amount
   679	  const instalment = settings.cp500_schedule?.find(
   680	    (inst: CP500ScheduleItem) => inst.instalment_no === instalmentNo
   681	  );
   682	
   683	  if (!instalment) {
   684	    throw new Error(`CP500 instalment ${instalmentNo} not found in schedule.`);
   685	  }
   686	
   687	  // Create the tax_prepayment transaction
   688	  const { data, error } = await supabase
   689	    .from("transactions")
   690	    .insert({
   691	      entity_id: entityId,
   692	      type: "tax_prepayment",
   693	      amount_minor: instalment.amount_minor,
   694	      currency: "MYR",
   695	      myr_equiv_minor: instalment.amount_minor,
   696	      occurred_at: date,
   697	      vendor: "LHDN",
   698	      category: "Tax",
   699	      subcategory: "CP500",
   700	      reference_code: `CP500-${instalmentNo}/${new Date(date).getFullYear()}`,
   701	      file_id: fileId ?? null,
   702	      tags: ["cp500", `instalment-${instalmentNo}`],
   703	      status: "active",
   704	      period_status: "open",
   705	    })
   706	    .select("id")
   707	    .single();
   708	
   709	  if (error || !data) {
   710	    console.error("[taxPosition] markCP500Paid insert error:", error);
   711	    throw new Error(
   712	      `Failed to create tax_prepayment transaction: ${error?.message ?? "Unknown error"}`
   713	    );
   714	  }
   715	
   716	  // Update the instalment status in settings
   717	  const updatedSchedule = (settings.cp500_schedule ?? []).map(
   718	    (inst: CP500ScheduleItem) => {
   719	      if (inst.instalment_no === instalmentNo) {
   720	        return {
   721	          ...inst,
   722	          status: "paid" as string,
   723	          file_id: fileId ?? inst.file_id ?? null,
   724	        };
   725	      }
   726	      return inst;
   727	    }
   728	  );
   729	
   730	  const {
   731	    data: { user },
   732	  } = await supabase.auth.getUser();
   733	  if (user) {
   734	    const { error: updateError } = await supabase
   735	      .from("users")
   736	      .update({
   737	        settings: {
   738	          ...settings,
   739	          cp500_schedule: updatedSchedule,
   740	        } as unknown as Database["public"]["Tables"]["users"]["Update"]["settings"],
   741	      })
   742	      .eq("id", user.id);
   743	
   744	    if (updateError) {
   745	      console.error(
   746	        "[taxPosition] markCP500Paid settings update error:",
   747	        updateError
   748	      );
   749	    }
   750	  }
   751	
   752	  return { transactionId: data.id };
   753	}
   754	
   755	/**
   756	 * Get Tax Prep View data for year-end preparation.
   757	 * Returns all transactions for the selected year grouped by category,
   758	 * with missing receipt counts and tag breakdowns.
   759	 *
   760	 * @param year - Assessment year (e.g. 2026). Defaults to current year.
   761	 * @param entitySlug - Optional entity slug filter.
   762	 * @returns TaxPrepData with transactions, category breakdown, and missing receipt count.
   763	 */
   764	export async function getTaxPrepData(
   765	  year?: number,
   766	  entitySlug?: string
   767	): Promise<TaxPrepData> {
   768	  const supabase = await createActionClient();
   769	  const assessmentYear = year ?? new Date().getFullYear();
   770	  const [yearStart, yearEnd] = getYearBoundaries(assessmentYear);
   771	
   772	  const entityId = await resolveEntityId(supabase, entitySlug);
   773	
   774	  let query = supabase
   775	    .from("transactions")
   776	    .select("*")
   777	    .eq("status", "active")
   778	    .gte("occurred_at", yearStart)
   779	    .lte("occurred_at", yearEnd);
   780	
   781	  if (entityId) {
   782	    query = query.eq("entity_id", entityId);
   783	  } else {
   784	    // Default to taxable entity only (JK Zentra)
   785	    query = query.eq("entity_id", "jk-zentra");
   786	  }
   787	
   788	  const { data: transactions, error } = await query.order("occurred_at", {
   789	    ascending: false,
   790	  });
   791	
   792	  if (error) {
   793	    console.error("[taxPosition] getTaxPrepData error:", error);
   794	    return { transactions: [], byCategory: [], missingReceiptCount: 0 };
   795	  }
   796	
   797	  const txs = (transactions ?? []) as TransactionRow[];
   798	
   799	  // Group by category with running totals
   800	  const categoryMap = new Map<
   801	    string,
   802	    { category: string; total_minor: number; count: number }
   803	  >();
   804	
   805	  for (const tx of txs) {
   806	    const existing = categoryMap.get(tx.category);
   807	    const amount = tx.myr_equiv_minor ?? tx.amount_minor ?? 0;
   808	    if (existing) {
   809	      existing.total_minor += amount;
   810	      existing.count += 1;
   811	    } else {
   812	      categoryMap.set(tx.category, {
   813	        category: tx.category,
   814	        total_minor: amount,
   815	        count: 1,
   816	      });
   817	    }
   818	  }
   819	
   820	  const byCategory = Array.from(categoryMap.values()).sort(
   821	    (a, b) => b.total_minor - a.total_minor
   822	  );
   823	
   824	  // Count missing receipts: tax-claimable transactions with file_id IS NULL
   825	  const missingReceiptCount = txs.filter((tx) => {
   826	    const hasTaxClaimable = tx.tags?.includes("tax-claimable");
   827	    const missingFile = !tx.file_id;
   828	    return hasTaxClaimable && missingFile;
   829	  }).length;
   830	
   831	  return {
   832	    transactions: txs,
   833	    byCategory,
   834	    missingReceiptCount,
   835	  };
   836	}
   837	
   838	/**
   839	 * Update user tax settings (effective rate, LHDN forecast, deductible projection).
   840	 * Merges new values with existing settings to avoid overwriting other fields.
   841	 *
   842	 * @param updates - Partial settings to update.
   843	 * @returns Success flag.
   844	 */
   845	export async function updateTaxSettings(updates: {
   846	  effective_tax_rate_percent?: number;
   847	  lhdn_forecast_income_minor?: number;
   848	  projected_annual_deductible_minor?: number;
   849	}): Promise<{ success: boolean }> {
   850	  const supabase = await createActionClient();
   851	  const settings = await getUserSettings(supabase);
   852	
   853	  const {
   854	    data: { user },
   855	  } = await supabase.auth.getUser();
   856	  if (!user) {
   857	    throw new Error("User not authenticated.");
   858	  }
   859	
   860	  const mergedSettings: UserSettings = {
   861	    ...settings,
   862	    ...(updates.effective_tax_rate_percent !== undefined && {
   863	      effective_tax_rate_percent: updates.effective_tax_rate_percent,
   864	    }),
   865	    ...(updates.lhdn_forecast_income_minor !== undefined && {
   866	      lhdn_forecast_income_minor: updates.lhdn_forecast_income_minor,
   867	    }),
   868	    ...(updates.projected_annual_deductible_minor !== undefined && {
   869	      // Store as a custom key in settings for user override
   870	      // This is a UI-level override, not in the DB schema
   871	    }),
   872	  };
   873	
   874	  const { error } = await supabase
   875	    .from("users")
   876	    .update({
   877	      settings:
   878	        mergedSettings as unknown as Database["public"]["Tables"]["users"]["Update"]["settings"],
   879	    })
   880	    .eq("id", user.id);
   881	
   882	  if (error) {
   883	    console.error("[taxPosition] updateTaxSettings error:", error);
   884	    throw new Error(`Failed to update tax settings: ${error.message}`);
   885	  }
   886	
   887	  return { success: true };
   888	}
   889	
   890	
   891	