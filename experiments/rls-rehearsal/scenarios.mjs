export const uid = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
export const U = {
  manager: uid(1),
  storyteller: uid(2),
  member: uid(3),
  removed: uid(4),
  otherManager: uid(5),
  other: uid(6),
  outsider: uid(7),
}
export const P = { a: uid(101), b: uid(102) }
export const S = { a: uid(201), b: uid(202) }
export const O = {
  audio: uid(301),
  saga: uid(302),
  removed: uid(303),
  image: uid(304),
  private: uid(305),
  other: uid(306),
  unrelated: uid(307),
  chunk: uid(308),
  interaction: uid(309),
}
export const keys = {
  audio: `${U.storyteller}/projects/${P.a}/stories/${S.a}/original.webm`,
  saga: `${U.storyteller}/projects/${P.a}/stories/${S.a}/photo.jpg`,
  removed: `${U.removed}/projects/${P.a}/stories/${S.a}/old.jpg`,
  image: `${U.storyteller}/images/stories/${S.a}/photo.jpg`,
  private: `${U.storyteller}/images/personal.jpg`,
  other: `${U.other}/projects/${P.b}/stories/${S.b}/original.webm`,
  unrelated: 'unrelated/public-test.txt',
  chunk: `${U.storyteller}/temp/session-a/chunk-0.webm`,
  interaction: `${U.storyteller}/images/interactions/${S.a}/reply.jpg`,
}

export async function seed(db) {
  await db.query('INSERT INTO public.projects VALUES ($1,$2,$3),($4,$5,$6)', [
    P.a,
    'Family A',
    U.manager,
    P.b,
    'Family B',
    U.otherManager,
  ])
  let n = 500
  for (const [actor, project, role, status] of [
    [U.manager, P.a, 'facilitator', 'active'],
    [U.storyteller, P.a, 'storyteller', 'active'],
    [U.member, P.a, 'storyteller', 'active'],
    [U.removed, P.a, 'storyteller', 'inactive'],
    [U.otherManager, P.b, 'facilitator', 'active'],
    [U.other, P.b, 'storyteller', 'active'],
  ])
    await db.query('INSERT INTO public.project_roles VALUES ($1,$2,$3,$4,$5)', [
      uid(n++),
      project,
      actor,
      role,
      status,
    ])
  await db.query(
    'INSERT INTO public.stories(id,project_id,storyteller_id,user_id,title,images,is_public) VALUES ($1,$2,$3,$3,$4,ARRAY[]::jsonb[],false),($5,$6,$7,$7,$8,ARRAY[]::jsonb[],false)',
    [S.a, P.a, U.storyteller, 'Story A', S.b, P.b, U.other, 'Story B']
  )
  for (const name of Object.keys(O)) {
    const bucket = ['audio', 'other', 'chunk'].includes(name)
      ? 'audio-recordings'
      : name === 'unrelated'
        ? 'unrelated'
        : 'saga'
    await db.query(
      'INSERT INTO storage.objects(id,bucket_id,name,owner,metadata) VALUES ($1,$2,$3,$4,$5)',
      [
        O[name],
        bucket,
        keys[name],
        name === 'other' ? U.other : name === 'removed' ? U.removed : U.storyteller,
        { synthetic: true },
      ]
    )
  }
  // This independent bucket policy must survive a scoped candidate unchanged.
  await db.query(
    "CREATE POLICY unrelated_bucket_read ON storage.objects FOR SELECT TO public USING (bucket_id='unrelated')"
  )
}

export async function characterize(h) {
  const { db, actor, observe, eq } = h
  await observe('exact_snapshot_policy_graph', async () => {
    const result = await actor('anon', null, 'SELECT id FROM storage.objects WHERE id=$1', [
      O.audio,
    ])
    return {
      result: result.error ? { code: result.error } : { rows: result.rows.length },
      mode: 'all 32 saved predicates with dependency RLS enabled',
    }
  })
  // Deliberately isolate the saved permissive predicates from dependency-table
  // RLS. These observations diagnose individual rules, not the whole deployment.
  for (const table of ['projects', 'project_roles', 'project_members', 'stories'])
    await db.query(`ALTER TABLE public.${table} DISABLE ROW LEVEL SECURITY`)
  await observe('isolated_audio_public_read', async () => {
    const r = await actor('anon', null, 'SELECT id FROM storage.objects WHERE id=$1', [O.audio])
    eq(r.rows?.length, 1, 'saved audio predicate admits anonymous row')
    return { mode: 'dependency RLS disabled', rows: r.rows.length }
  })
  await observe('isolated_audio_cross_project_insert', async () => {
    const r = await actor(
      'authenticated',
      U.other,
      'INSERT INTO storage.objects(id,bucket_id,name,owner) VALUES ($1,$2,$3,$4) RETURNING id',
      [
        uid(901),
        'audio-recordings',
        `${U.other}/projects/${P.a}/stories/temp/foreign.webm`,
        U.other,
      ]
    )
    eq(r.rows?.length, 1, 'saved audio predicate admits foreign project upload')
    return { mode: 'dependency RLS disabled', rows: r.rows.length }
  })
  await observe('isolated_removed_uploader_read', async () => {
    const r = await actor(
      'authenticated',
      U.removed,
      'SELECT id FROM storage.objects WHERE id=$1',
      [O.removed]
    )
    eq(r.rows?.length, 1, 'saved prefix-only predicate ignores removal')
    return { mode: 'dependency RLS disabled', rows: r.rows.length }
  })
  await observe('isolated_project_name_binding', async () => {
    let r = await actor('authenticated', U.member, 'SELECT id FROM storage.objects WHERE id=$1', [
      O.saga,
    ])
    eq(r.rows?.length, 0, 'ordinary project name fails old member branch')
    await db.query('UPDATE public.projects SET name=$1 WHERE id=$2', [
      `arbitrary/projects/${P.b}/tail`,
      P.b,
    ])
    r = await actor('authenticated', U.other, 'SELECT id FROM storage.objects WHERE id=$1', [
      O.saga,
    ])
    eq(r.rows?.length, 1, 'path-like own project name admits another project object')
    await db.query('UPDATE public.projects SET name=$1 WHERE id=$2', ['Family B', P.b])
    return { mode: 'dependency RLS disabled', ordinaryMemberRows: 0, crossProjectRows: 1 }
  })
  await observe('isolated_story_insert_or_branch', async () => {
    await db.query('ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY')
    const r = await actor(
      'authenticated',
      U.outsider,
      'INSERT INTO public.stories(id,project_id,storyteller_id,user_id,title) VALUES ($1,$2,$3,$3,$4) RETURNING id',
      [uid(902), P.a, U.outsider, 'Synthetic outsider story']
    )
    // RETURNING additionally invokes the saved SELECT policy, whose storyteller
    // branch accepts this synthetic actor. The actor transaction is rolled back.
    eq(r.rows?.length, 1, 'saved permissive OR branch permits unrelated storyteller')
    await db.query('ALTER TABLE public.stories DISABLE ROW LEVEL SECURITY')
    return { mode: 'projects/roles/member RLS disabled', rows: 1 }
  })
}

export async function verifyCandidate(h) {
  const { db, actor, scenario, eq, ok, client } = h
  const readObject = (role, who, id) =>
    actor(role, who, 'SELECT id FROM storage.objects WHERE id=$1', [id])
  const denyResult = (r, label) => {
    ok(!r.error || r.error === '42501', `${label}: expected RLS denial, not arbitrary SQL error`)
    eq(r.rows?.length ?? 0, 0, label)
  }
  const allowRead = async (who, id) => {
    const r = await readObject('authenticated', who, id)
    eq(r.error, undefined, 'query must not fail')
    eq(r.rows.length, 1, 'permitted row visible')
  }
  await scenario('anonymous_cannot_read_audio', async () =>
    denyResult(await readObject('anon', null, O.audio), 'anonymous audio hidden')
  )
  await scenario('anonymous_with_subject_claim_still_denied', async () =>
    denyResult(
      await readObject('anon', U.storyteller, O.audio),
      'anon role cannot use a subject claim'
    )
  )
  for (const who of [U.other, U.outsider, U.removed])
    await scenario(`foreign_or_removed_audio_${who}`, async () =>
      denyResult(
        await readObject('authenticated', who, O.audio),
        'foreign/removed project audio hidden'
      )
    )
  for (const who of [U.manager, U.storyteller, U.member])
    await scenario(`current_member_reads_both_buckets_${who}`, async () => {
      await allowRead(who, O.audio)
      await allowRead(who, O.saga)
    })
  await scenario('removed_original_uploader_has_no_prefix_exception', async () =>
    denyResult(await readObject('authenticated', U.removed, O.removed), 'removed prefix denied')
  )
  await scenario('path_like_project_name_cannot_grant_foreign_access', async () => {
    await db.query('UPDATE public.projects SET name=$1 WHERE id=$2', [
      `x/projects/${P.b}/tail`,
      P.b,
    ])
    try {
      denyResult(
        await readObject('authenticated', U.other, O.saga),
        'object project wins over project name'
      )
      await allowRead(U.member, O.saga)
    } finally {
      await db.query('UPDATE public.projects SET name=$1 WHERE id=$2', ['Family B', P.b])
    }
  })
  for (const id of [O.image, O.interaction])
    await scenario(`story_scoped_image_${id}`, async () => {
      await allowRead(U.member, id)
      denyResult(await readObject('authenticated', U.other, id), 'foreign story image denied')
    })
  for (const id of [O.private, O.chunk])
    await scenario(`private_media_${id}`, async () => {
      await allowRead(U.storyteller, id)
      denyResult(
        await readObject('authenticated', U.member, id),
        'same-project member cannot read private data'
      )
    })
  await scenario('unrelated_bucket_policy_is_preserved', async () => {
    const r = await readObject('anon', null, O.unrelated)
    eq(r.error, undefined, 'unrelated policy still works')
    eq(r.rows.length, 1, 'unrelated row visible')
  })
  const insert = async (who, bucket, key) =>
    actor(
      'authenticated',
      who,
      'INSERT INTO storage.objects(id,bucket_id,name,owner) VALUES ($1,$2,$3,$4) RETURNING id',
      [uid(903), bucket, key, who]
    )
  for (const [bucket, key] of [
    ['audio-recordings', `${U.storyteller}/projects/${P.a}/stories/temp/new.webm`],
    ['saga', `${U.storyteller}/images/stories/${S.a}/new.jpg`],
    ['audio-recordings', `${U.storyteller}/temp/session-a/new.webm`],
  ])
    await scenario(`authorized_insert_${bucket}_${key.split('/')[1]}`, async () => {
      const r = await insert(U.storyteller, bucket, key)
      eq(r.error, undefined, 'valid upload accepted')
      eq(r.rows.length, 1, 'insert result')
    })
  await scenario('canonical_edge_whitespace_matches_ecmascript_trim', async () => {
    // ECMAScript WhiteSpace + LineTerminator code points, independent of SQL.
    const codePoints = [
      0x0009, 0x000a, 0x000b, 0x000c, 0x000d, 0x0020, 0x00a0, 0x1680,
      0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007,
      0x2008, 0x2009, 0x200a, 0x2028, 0x2029, 0x202f, 0x205f, 0x3000, 0xfeff,
    ]
    for (const codePoint of codePoints) {
      const ch = String.fromCodePoint(codePoint)
      const plain = `${U.storyteller}/temp/new.webm`
      for (const key of [ch + plain, plain + ch]) {
        eq(key.trim(), plain, `canonical parser rejects edge U+${codePoint.toString(16)}`)
        denyResult(
          await insert(U.storyteller, 'audio-recordings', key),
          `edge whitespace U+${codePoint.toString(16)} denied`
        )
      }
    }
  })
  await scenario('interior_unicode_filename_remains_valid', async () => {
    const r = await insert(U.storyteller, 'audio-recordings', `${U.storyteller}/temp/a\u3000b.webm`)
    eq(r.error, undefined, 'ordinary interior Unicode is preserved')
    eq(r.rows.length, 1, 'interior Unicode upload accepted')
  })
  const invalidKeys = [
    null,
    '',
    `${U.other}/projects/${P.a}/stories/temp/x.webm`,
    `${U.storyteller}/projects/${P.b}/stories/temp/x.webm`,
    `${U.storyteller}/projects/${uid(999)}/x.webm`,
    `${U.storyteller}/images/stories/${S.b}/x.jpg`,
    `${U.storyteller}/images/stories/${uid(999)}/x.jpg`,
    `${U.storyteller}/projects/not-a-uuid/x`,
    `${U.storyteller}/images/stories/bad/x`,
    `${U.storyteller}/images/stories`,
    `${U.storyteller}/projects/${P.a}`,
    `${U.storyteller}/images//x`,
    `${U.storyteller}/images/../x`,
    `${U.storyteller}/images/./x`,
    `${U.storyteller}/images/projects/${P.a}/x`,
    `${U.storyteller}/images/x%2Fy`,
    `${U.storyteller}/images/x?y`,
    `${U.storyteller}/images/x#y`,
    `${U.storyteller}/images/x:y`,
    `${U.storyteller}/images/x\\y`,
    `${U.storyteller}/images/x\ny`,
    `${U.storyteller}/images/x `,
    ` ${U.storyteller}/images/x`,
    `${U.storyteller}/images/x\u00a0`,
    `${U.storyteller}/images/x\u0085`,
    `stories/legacy.webm`,
    `anonymous/images/x.jpg`,
  ]
  for (const [index, key] of invalidKeys.entries())
    await scenario(`invalid_or_unauthorized_key_${index + 1}`, async () =>
      denyResult(
        await insert(U.storyteller, 'audio-recordings', key),
        'invalid/unauthorized insert denied'
      )
    )
  await scenario('object_owner_metadata_cannot_impersonate_another_user', async () =>
    denyResult(
      await actor(
        'authenticated',
        U.storyteller,
        'INSERT INTO storage.objects(id,bucket_id,name,owner) VALUES ($1,$2,$3,$4) RETURNING id',
        [uid(903), 'audio-recordings', `${U.storyteller}/temp/new.webm`, U.other]
      ),
      'owner mismatch denied'
    )
  )
  await scenario('owner_id_compatibility_still_requires_path_and_membership', async () => {
    const sql =
      'INSERT INTO storage.objects(id,bucket_id,name,owner_id) VALUES ($1,$2,$3,$4) RETURNING id'
    const values = [uid(903), 'audio-recordings', `${U.storyteller}/temp/new.webm`, U.storyteller]
    const r = await actor('authenticated', U.storyteller, sql, values)
    eq(r.error, undefined, 'owner_id form allowed')
    eq(r.rows.length, 1, 'owner_id insert accepted')
    denyResult(
      await actor('authenticated', U.storyteller, sql, [...values.slice(0, 3), U.other]),
      'owner_id spoof denied'
    )
  })
  await scenario('managed_objects_cannot_be_overwritten_renamed_or_deleted', async () => {
    for (const who of [U.storyteller, U.manager]) {
      for (const sql of [
        'UPDATE storage.objects SET metadata=$2 WHERE id=$1 RETURNING id',
        'UPDATE storage.objects SET name=$2 WHERE id=$1 RETURNING id',
        'DELETE FROM storage.objects WHERE id=$1 RETURNING id',
      ])
        denyResult(
          await actor(
            'authenticated',
            who,
            sql,
            sql.includes('$2')
              ? [O.audio, sql.includes('metadata') ? { tampered: true } : 'renamed']
              : [O.audio]
          ),
          'managed mutation denied'
        )
    }
    const r = await actor(
      'authenticated',
      U.storyteller,
      "INSERT INTO storage.objects(id,bucket_id,name,owner,metadata) VALUES ($1,$2,$3,$4,'{}') ON CONFLICT(bucket_id,name) DO UPDATE SET metadata='{}' RETURNING id",
      [uid(904), 'audio-recordings', keys.audio, U.storyteller]
    )
    denyResult(r, 'upsert overwrite denied')
    eq(
      (await db.query('SELECT name,metadata FROM storage.objects WHERE id=$1', [O.audio])).rows[0],
      { name: keys.audio, metadata: { synthetic: true } },
      'original object unchanged'
    )
  })
  await scenario('unknown_permissive_policy_cannot_reopen_managed_access', async () => {
    await db.query(
      'CREATE POLICY unexpected_broad_policy ON storage.objects FOR ALL TO public USING (true) WITH CHECK (true)'
    )
    try {
      denyResult(await readObject('anon', null, O.audio), 'restrictive anon gate')
      denyResult(await readObject('authenticated', U.other, O.audio), 'restrictive project gate')
      denyResult(
        await insert(U.other, 'saga', `${U.other}/projects/${P.a}/x.jpg`),
        'restrictive insert gate'
      )
      denyResult(
        await actor(
          'authenticated',
          U.storyteller,
          'DELETE FROM storage.objects WHERE id=$1 RETURNING id',
          [O.audio]
        ),
        'restrictive delete gate'
      )
    } finally {
      await db.query('DROP POLICY unexpected_broad_policy ON storage.objects')
    }
  })
  await scenario('projects_and_role_queries_have_no_recursive_policy_error', async () => {
    const p = await actor('authenticated', U.member, 'SELECT id FROM public.projects ORDER BY id')
    eq(p.error, undefined, 'no recursive project error')
    eq(
      p.rows.map(r => r.id),
      [P.a],
      'only own project'
    )
    const r = await actor(
      'authenticated',
      U.member,
      'SELECT user_id FROM public.project_roles ORDER BY user_id'
    )
    eq(r.error, undefined, 'no recursive role error')
    eq(
      r.rows.map(x => x.user_id),
      [U.member],
      'ordinary member sees own role'
    )
  })
  await scenario('story_reads_require_current_project_membership', async () => {
    let r = await actor('authenticated', U.member, 'SELECT id FROM public.stories WHERE id=$1', [
      S.a,
    ])
    eq(r.error, undefined, 'member story query works')
    eq(r.rows.length, 1, 'member story visible')
    denyResult(
      await actor('authenticated', U.other, 'SELECT id FROM public.stories WHERE id=$1', [S.a]),
      'foreign story hidden'
    )
  })
  const storyInsert = (who, project, storyteller = who, user = who) =>
    actor(
      'authenticated',
      who,
      'INSERT INTO public.stories(id,project_id,storyteller_id,user_id,title) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [uid(905), project, storyteller, user, 'Synthetic new story']
    )
  await scenario('story_insert_is_own_active_storyteller_only', async () => {
    const r = await storyInsert(U.storyteller, P.a)
    eq(r.error, undefined, 'own story insert accepted')
    eq(r.rows.length, 1, 'own story inserted')
    for (const args of [
      [U.other, P.a],
      [U.outsider, P.a],
      [U.removed, P.a],
      [U.manager, P.a],
      [U.storyteller, P.a, U.other],
      [U.storyteller, P.a, U.storyteller, U.other],
    ])
      denyResult(await storyInsert(...args), 'foreign/role/identity insert denied')
  })
  await scenario('story_edit_does_not_transfer_project_or_creator', async () => {
    let r = await actor(
      'authenticated',
      U.storyteller,
      'UPDATE public.stories SET title=$2 WHERE id=$1 RETURNING id',
      [S.a, 'Edited synthetic title']
    )
    eq(r.error, undefined, 'own edit allowed')
    eq(r.rows.length, 1, 'own edit succeeds')
    denyResult(
      await actor(
        'authenticated',
        U.member,
        'UPDATE public.stories SET title=$2 WHERE id=$1 RETURNING id',
        [S.a, 'Another author']
      ),
      'another author denied'
    )
    // Give the actor a valid role in B: identity immutability must still reject a move.
    await db.query('INSERT INTO public.project_roles VALUES ($1,$2,$3,$4,$5)', [
      uid(599),
      P.b,
      U.storyteller,
      'storyteller',
      'active',
    ])
    try {
      for (const [column, value] of [
        ['project_id', P.b],
        ['storyteller_id', U.member],
        ['user_id', null],
        ['id', uid(906)],
      ])
        denyResult(
          await actor(
            'authenticated',
            U.storyteller,
            `UPDATE public.stories SET ${column}=$2 WHERE id=$1 RETURNING id`,
            [S.a, value]
          ),
          'story identity immutable'
        )
    } finally {
      await db.query('DELETE FROM public.project_roles WHERE id=$1', [uid(599)])
    }
  })
  await scenario('raw_story_delete_stays_closed_until_tombstone_adapter', async () =>
    denyResult(
      await actor(
        'authenticated',
        U.manager,
        'DELETE FROM public.stories WHERE id=$1 RETURNING id',
        [S.a]
      ),
      'no raw destructive shortcut'
    )
  )
  await scenario('unexpected_story_policy_cannot_override_project_boundary', async () => {
    await db.query(
      'CREATE POLICY unexpected_story_policy ON public.stories FOR ALL TO public USING(true) WITH CHECK(true)'
    )
    try {
      denyResult(await storyInsert(U.outsider, P.a), 'restrictive story insert gate')
      denyResult(
        await actor('authenticated', U.other, 'SELECT id FROM public.stories WHERE id=$1', [S.a]),
        'restrictive story read gate'
      )
    } finally {
      await db.query('DROP POLICY unexpected_story_policy ON public.stories')
    }
  })
  await scenario('revocation_applies_on_next_read_committed_statement', async () => {
    const c = await client()
    try {
      await c.query('BEGIN')
      await c.query('SET LOCAL ROLE authenticated')
      await c.query(
        "SELECT set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role','authenticated',true)",
        [U.storyteller]
      )
      eq(
        (await c.query('SELECT id FROM storage.objects WHERE id=$1', [O.audio])).rows.length,
        1,
        'visible before revoke'
      )
      await db.query(
        "UPDATE public.project_roles SET status='inactive' WHERE project_id=$1 AND user_id=$2",
        [P.a, U.storyteller]
      )
      eq(
        (await c.query('SELECT id FROM storage.objects WHERE id=$1', [O.audio])).rows.length,
        0,
        'next statement sees removal'
      )
      eq(
        (await c.query('SELECT id FROM public.stories WHERE id=$1', [S.a])).rows.length,
        0,
        'author status cannot bypass removal'
      )
    } finally {
      await c.query('ROLLBACK')
      await c.end()
      await db.query(
        "UPDATE public.project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",
        [P.a, U.storyteller]
      )
    }
  })
  await scenario('old_repeatable_read_snapshot_is_not_instantly_revoked', async () => {
    const c = await client()
    try {
      await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ')
      await c.query('SET LOCAL ROLE authenticated')
      await c.query(
        "SELECT set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",
        [U.storyteller]
      )
      eq(
        (await c.query('SELECT id FROM storage.objects WHERE id=$1', [O.audio])).rows.length,
        1,
        'visible before revoke'
      )
      await db.query(
        "UPDATE public.project_roles SET status='inactive' WHERE project_id=$1 AND user_id=$2",
        [P.a, U.storyteller]
      )
      eq(
        (await c.query('SELECT id FROM storage.objects WHERE id=$1', [O.audio])).rows.length,
        1,
        'old MVCC snapshot persists: explicit limitation'
      )
      denyResult(
        await readObject('authenticated', U.storyteller, O.audio),
        'new transaction denies removed user'
      )
    } finally {
      await c.query('ROLLBACK')
      await c.end()
      await db.query(
        "UPDATE public.project_roles SET status='active' WHERE project_id=$1 AND user_id=$2",
        [P.a, U.storyteller]
      )
    }
  })
  await scenario('fixed_security_definer_helpers_cannot_be_replaced_by_caller', async () => {
    const r = await actor(
      'authenticated',
      U.storyteller,
      'CREATE TABLE saga_rls_guard.spoof(id integer)'
    )
    eq(r.error, '42501', 'schema creation denied')
    const funcs = (
      await db.query(
        "SELECT prosecdef,proconfig,p.prorettype='trigger'::regtype AS is_trigger FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='saga_rls_guard'"
      )
    ).rows
    ok(funcs.length > 0, 'helpers exist')
    ok(
      funcs.every(
        f => (f.is_trigger ? !f.prosecdef : f.prosecdef) && f.proconfig?.includes('search_path=""')
      ),
      'narrow helper privilege and fixed search path'
    )
  })
}
