<script>
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
</script>

<Navbar>
	<NavBrand href="/">
		<span class="pr-2">
			<img src="logo.png" width="52" alt="KDC Logo" />
		</span>
		<span class="self-center text-2xl font-semibold whitespace-nowrap dark:text-white"
			>Project Dashboard</span
		>
	</NavBrand>
	<NavHamburger />
	<NavUl>
		<span class="nowrap flex flex-row gap-2 text-lg">
			<NavLi href="/">Home</NavLi>
			<!-- <NavLi href="/architect-project-tasks">Architect Project Tasks</NavLi> -->
			<!-- <NavLi href="/architect-projects">Architect Projects</NavLi> -->
			<!-- <NavLi href="/studio">Studio</NavLi> -->
			<!-- <NavLi href="/studio-projects">Studio Projects</NavLi> -->
			<!-- <NavLi href="/projects">Projects</NavLi> -->
			<NavLi href="/tasks-editor">Tasks Editor</NavLi>
			<NavLi href="/projects-editor">Projects Editor</NavLi>
			<NavLi href="/architects-editor">Architects Editor</NavLi>
			<NavLi href="/tts-settings">TTS Settings</NavLi>
		</span>
	</NavUl>
</Navbar>
