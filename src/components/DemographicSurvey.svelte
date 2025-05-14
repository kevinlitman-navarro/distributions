<script>
  import { createEventDispatcher, onMount } from 'svelte';
  const dispatch = createEventDispatcher();

  let age = $state('');
  let sex = $state('');
  let submitted = $state(false);

  const ageOptions = [
    { value: '18-24', label: '18-24' },
    { value: '25-34', label: '25-34' },
    { value: '35-44', label: '35-44' },
    { value: '45-54', label: '45-54' },
    { value: '55-64', label: '55-64' },
    { value: '65+', label: '65+' }
  ];

  const sexOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'neither', label: 'Neither' }
  ];

  onMount(() => {
    const stored = localStorage.getItem('completeResponseData');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.demographics && parsed.demographics.age && parsed.demographics.sex) {
          submitted = true;
        }
      } catch (e) {}
    }
  });

  function handleSubmit() {
    // Get all responses from localStorage
    const userVotes = JSON.parse(localStorage.getItem('userVotes') || '{}');
    const answeredQuestions = JSON.parse(localStorage.getItem('answeredQuestions') || '[]');
    
    // Create a complete response object with null values for missing demographic data
    const responseData = {
      demographics: {
        age: age || null,
        sex: sex || null
      },
      responses: userVotes,
      answeredQuestions
    };

    // Save to localStorage
    localStorage.setItem('completeResponseData', JSON.stringify(responseData));
    submitted = true;
    // Dispatch event to parent
    dispatch('complete', responseData);
  }
</script>

<div class="demographic-survey">
  {#if !submitted}
    <form on:submit|preventDefault={handleSubmit}>
      <div class="form-group">
        <label for="age">What is your age?</label>
        <select 
          id="age" 
          bind:value={age}
        >
          <option value="">Select age range</option>
          {#each ageOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <div class="form-group">
        <label for="sex">What is your sex?</label>
        <select 
          id="sex" 
          bind:value={sex}
        >
          <option value="">Select sex</option>
          {#each sexOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </div>

      <button type="submit">
        Submit
      </button>
    </form>
  {:else}
    <div class="thank-you-message">
      <h2>Thank you for submitting your demographic information!</h2>
    </div>
  {/if}
</div>

<style>
  .demographic-survey {
    max-width: 600px;
    margin: 2rem auto;
    padding: 2.5rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    transition: transform 0.2s;
  }

  .demographic-survey:hover {
    transform: translateY(-2px);
  }

  h2 {
    text-align: center;
    color: #2c3e50;
    margin-bottom: 2rem;
    font-size: 1.8rem;
    font-weight: 600;
    letter-spacing: -0.5px;
  }

  .form-group {
    margin-bottom: 2rem;
  }

  label {
    display: block;
    margin-bottom: 0.75rem;
    color: #4a5568;
    font-weight: 500;
    font-size: 1.1rem;
  }

  select {
    width: 100%;
    padding: 1rem;
    border: 2px solid #e2e8f0;
    border-radius: 8px;
    font-size: 1.1rem;
    color: #2d3748;
    background: white;
    transition: all 0.2s;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%234a5568' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    background-size: 1.5rem;
  }

  select:hover {
    border-color: #4a90e2;
  }

  select:focus {
    outline: none;
    border-color: #4a90e2;
    box-shadow: 0 0 0 3px rgba(74, 144, 226, 0.1);
  }

  button {
    width: 100%;
    padding: 1.25rem;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 1.1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  button:hover {
    background: #357abd;
    transform: translateY(-1px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  button:active {
    transform: translateY(0);
    box-shadow: none;
  }

  @media (max-width: 768px) {
    .demographic-survey {
      padding: 1.5rem;
      margin: 1rem;
    }

    h2 {
      font-size: 1.5rem;
    }

    label {
      font-size: 1rem;
    }

    select {
      padding: 0.75rem;
      font-size: 1rem;
    }

    button {
      padding: 1rem;
      font-size: 1rem;
    }
  }
</style> 