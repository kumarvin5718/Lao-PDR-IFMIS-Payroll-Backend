package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.Country;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CountryRepository extends JpaRepository<Country, String> {
    Optional<Country> findByName(String name);
}
