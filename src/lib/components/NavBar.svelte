<script>
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
	import { PUBLIC_LOGO_FILE_NAME, PUBLIC_PROJECT_TITLE } from '$env/static/public';

	let { authenticated = false } = $props();

	let showLogin = $state(false);
	let password = $state('');
	let error = $state('');
	let loggingIn = $state(false);

	const logo = PUBLIC_LOGO_FILE_NAME;
	const title = PUBLIC_PROJECT_TITLE;

	function toggleLogin() {
		showLogin = !showLogin;
		password = '';
		error = '';
	}

	async function handleLogin() {
		loggingIn = true;
		error = '';
		try {
			const res = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ password })
			});
			if (res.ok) {
				window.location.reload();
			} else {
				const data = await res.json();
				error = data.error || 'Login failed';
			}
		} catch {
			error = 'Network error';
		} finally {
			loggingIn = false;
		}
	}

	async function handleLogout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		window.location.reload();
	}
</script>

<Navbar class="border-b border-gray-200 py-2" breakpoint="lg">
	<NavBrand href="/">
		<span class="px-2">
			{#if logo}
				<img
					src={logo}
					class="h-8 w-8 object-contain sm:h-10 sm:w-10 md:h-13 md:w-13"
					alt="KDC Logo"
				/>
			{/if}
		</span>
		<span
			class="self-center truncate text-sm font-semibold whitespace-nowrap sm:text-base md:text-lg lg:text-2xl dark:text-white"
			>{title || 'Project Dashboard'}</span
		>
	</NavBrand>
	<NavHamburger />
	<NavUl ulClass="p-2">
		<span class="nowrap flex flex-col gap-2 text-lg md:flex-row md:items-center">
			<NavLi href="/">Home</NavLi>
			{#if authenticated}
				<NavLi href="/tasks-editor">Tasks Editor</NavLi>
				<NavLi href="/projects-editor">Projects Editor</NavLi>
				<NavLi href="/architects-editor">Architects Editor</NavLi>
			{/if}
			<NavLi href="/reports">Reports</NavLi>
			<NavLi href="/tts">TTS</NavLi>
			{#if authenticated}
				<button
					onclick={handleLogout}
					class="rounded-md bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-300"
				>
					Logout
				</button>
			{:else}
				<div class="relative">
					<button
						onclick={toggleLogin}
						class="w-full rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 md:w-auto"
					>
						Login
					</button>
					{#if showLogin}
						<div
							class="fixed inset-0 z-40"
							role="presentation"
							onclick={() => {
								showLogin = false;
							}}
							onkeydown={() => {}}
						></div>
						<div
							class="absolute top-full right-0 left-0 z-50 mx-auto mt-1 w-64 max-w-[90vw] rounded-lg border border-gray-200 bg-white p-4 shadow-lg md:left-auto md:mx-0"
							role="presentation"
							onclick={(e) => e.stopPropagation()}
							onkeydown={() => {}}
						>
							<form
								onsubmit={(e) => {
									e.preventDefault();
									handleLogin();
								}}
							>
								<label class="mb-1 block text-sm font-medium text-gray-700" for="login-password">
									Password
								</label>
								<input
									id="login-password"
									type="password"
									bind:value={password}
									class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
									placeholder="Enter password"
								/>
								<button
									type="submit"
									disabled={loggingIn || !password}
									class="mt-2 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
								>
									{loggingIn ? 'Signing in...' : 'Sign In'}
								</button>
								{#if error}
									<p class="mt-2 text-sm text-red-600">{error}</p>
								{/if}
							</form>
						</div>
					{/if}
				</div>
			{/if}
		</span>
	</NavUl>
</Navbar>
